import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get validated content using shared helper (auto re-extracts if needed)
    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Rate limit check (per-user, per-function)
    const { data: rl } = await supabase.rpc("check_ai_rate_limit", {
      _user_id: doc.user_id, _function_name: "generate-notes",
    });
    if (rl && rl.allowed === false) {
      return new Response(JSON.stringify({
        error: rl.reason === "hourly_limit"
          ? `Hourly limit reached (${rl.limit}/hr on ${rl.plan} plan). Try again in an hour.`
          : `Daily limit reached (${rl.limit}/day on ${rl.plan} plan). Try again tomorrow or upgrade.`,
        rateLimited: true, ...rl,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert study notes creator. Generate beautiful, comprehensive study notes in markdown format from the provided content. Follow this exact style:

1. Start with a main title using # with a relevant emoji (e.g., "# 📚 Software Engineering Overview")
2. Add a "## Brief Overview" section with a short paragraph summarizing the document
3. Add a "## Key Points" section with bullet points
4. Then create detailed sections for each major topic using ## headings with relevant emojis
5. Use **bold text** for important terms and key concepts
6. Use > blockquotes for definitions and important statements
7. Use --- horizontal rules between major sections
8. Use ### for sub-sections within major topics
9. Include bullet points and numbered lists where appropriate
10. Make the notes thorough, covering ALL content from the source material
11. Use emojis in section headings to make them visually distinct

The notes should be detailed, well-structured, and visually appealing when rendered as markdown. Cover every topic mentioned in the source content thoroughly.`
          },
          {
            role: "user",
            content: `Generate detailed study notes from the following content:\n\n${content.substring(0, 15000)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Note generation failed. Please try again.");
    }

    const aiData = await aiResponse.json();
    const notesContent = aiData.choices?.[0]?.message?.content || "No notes generated.";

    await supabase.from("notes").insert({
      user_id: doc.user_id,
      document_id: documentId,
      title: `Notes: ${doc.title}`,
      content: notesContent,
    });

    await supabase.from("documents").update({ status: "completed" }).eq("id", documentId);

    // Log successful AI usage for rate limiting
    await supabase.from("ai_usage_log").insert({ user_id: doc.user_id, function_name: "generate-notes" });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
