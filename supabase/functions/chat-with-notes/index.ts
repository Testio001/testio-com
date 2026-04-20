import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUESTION_LIMITS: Record<string, number> = {
  free: 5,
  basic: 21,
  pro: 21,
};

function extractSummary(noteContent: string): string {
  const overviewMatch = noteContent.match(/## Brief Overview[\s\S]*?(?=\n## |$)/);
  const keyPointsMatch = noteContent.match(/## Key Points[\s\S]*?(?=\n## |$)/);

  let summary = "";
  if (overviewMatch) summary += overviewMatch[0].trim() + "\n\n";
  if (keyPointsMatch) summary += keyPointsMatch[0].trim() + "\n\n";

  return summary || noteContent.substring(0, 2000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, message, history } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let plan = "free";

    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        userId = user.id;
        // Get plan
        const { data: profile } = await supabase.from("profiles").select("subscription_plan, subscription_expires_at").eq("user_id", user.id).single();
        if (profile) {
          const isExpired = profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date();
          plan = isExpired ? "free" : (profile.subscription_plan || "free");
        }
      }
    }

    // Enforce question limit per document
    if (userId) {
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("user_id", userId)
        .eq("role", "user");

      const limit = QUESTION_LIMITS[plan] || 5;
      if ((count ?? 0) >= limit) {
        const upgradeMsg = plan === "free"
          ? "You've used all 5 free questions for this document. Upgrade to Basic or Pro for 21 questions per document."
          : "You've reached the 21-question limit for this document.";
        return new Response(JSON.stringify({ error: upgradeMsg, limitReached: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get document title
    const { data: doc } = await supabase.from("documents").select("title").eq("id", documentId).single();

    // Get notes and extract summary only
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const validNotes = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n\n") || "";
    const summaryContext = extractSummary(validNotes);

    // Only use last 3 messages as context
    const recentHistory = (history || []).slice(-3);

    const messages = [
      {
        role: "system",
        content: `You are Testio AI, a helpful study assistant. Answer based on the document summary below. Be concise — keep responses under 100 words.\n\nDocument: ${doc?.title || "Untitled"}\n\nSummary:\n${summaryContext}`
      },
      ...recentHistory,
      { role: "user", content: message }
    ];

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 200 }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Chat failed. Please try again.");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
