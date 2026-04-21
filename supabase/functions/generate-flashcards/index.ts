import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractSummary(noteContent: string): string {
  const overviewMatch = noteContent.match(/## Brief Overview[\s\S]*?(?=\n## |$)/);
  const keyPointsMatch = noteContent.match(/## Key Points[\s\S]*?(?=\n## |$)/);
  let summary = "";
  if (overviewMatch) summary += overviewMatch[0].trim() + "\n\n";
  if (keyPointsMatch) summary += keyPointsMatch[0].trim() + "\n\n";
  const sectionMatches = noteContent.match(/## .+[\s\S]*?(?=\n## |$)/g);
  if (sectionMatches && !summary) {
    summary = sectionMatches.map(s => s.substring(0, 500)).join("\n\n");
  }
  return summary || noteContent.substring(0, 4000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, count } = await req.json();
    const cardCount = count || 15;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Rate limit check (per-user, per-function)
    const { data: rl } = await supabase.rpc("check_ai_rate_limit", {
      _user_id: doc.user_id, _function_name: "generate-flashcards",
    });
    if (rl && rl.allowed === false) {
      return new Response(JSON.stringify({
        error: rl.reason === "hourly_limit"
          ? `Hourly limit reached (${rl.limit}/hr on ${rl.plan} plan). Try again in an hour.`
          : `Daily limit reached (${rl.limit}/day on ${rl.plan} plan). Try again tomorrow or upgrade.`,
        rateLimited: true, ...rl,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use summary from notes instead of full content
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n");
    const sourceContent = noteContent ? extractSummary(noteContent) : content.substring(0, 4000);

    // Get existing cards to avoid duplicates
    const { data: existingSets } = await supabase.from("flashcard_sets").select("id").eq("document_id", documentId);
    let existingFronts: string[] = [];
    if (existingSets && existingSets.length > 0) {
      const { data: existing } = await supabase.from("flashcard_cards").select("front").in("flashcard_set_id", existingSets.map((s: any) => s.id));
      existingFronts = existing?.map((c: any) => c.front) || [];
    }

    // Pass ALL existing fronts to the AI (truncated to ~3000 chars), not just last 30
    const existingJoined = existingFronts.join("\n");
    const truncatedExisting = existingJoined.length > 3000 ? existingJoined.substring(existingJoined.length - 3000) : existingJoined;
    const avoidPrompt = existingFronts.length > 0
      ? `\n\nCRITICAL: You MUST create flashcards covering DIFFERENT subtopics, terms, or details than the ones below. Do NOT repeat or rephrase any of these — pick fresh angles, deeper concepts, or new sections.\n\nALREADY CREATED (do NOT repeat or rephrase):\n${truncatedExisting}`
      : "";

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85,
        messages: [
          { role: "system", content: "Generate flashcards from the provided study summary. Cover DIFFERENT angles each time. Return ONLY valid JSON." },
          { role: "user", content: `Create ${cardCount} NEW unique flashcards from this content summary. Return JSON array with objects having "front" (question) and "back" (answer) fields.${avoidPrompt}\n\nContent Summary:\n${sourceContent}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_flashcards",
            description: "Create flashcards from content",
            parameters: {
              type: "object",
              properties: {
                cards: { type: "array", items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false } }
              },
              required: ["cards"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_flashcards" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Flashcard generation failed. Please try again.");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let cards = JSON.parse(toolCall?.function?.arguments || "{}").cards || [];

    // Client-side dedupe: drop any card whose front matches an existing one
    const existingLower = new Set(existingFronts.map((f: string) => f.toLowerCase().trim()));
    cards = cards.filter((c: any) => !existingLower.has(c.front.toLowerCase().trim()));

    const { data: set } = await supabase.from("flashcard_sets").insert({
      user_id: doc.user_id, document_id: documentId, title: `Flashcards: ${doc.title}`,
    }).select().single();

    if (set && cards.length > 0) {
      const startIndex = existingFronts.length;
      await supabase.from("flashcard_cards").insert(
        cards.map((c: any, i: number) => ({
          flashcard_set_id: set.id, front: c.front, back: c.back, order_index: startIndex + i,
        }))
      );
    }

    await supabase.from("ai_usage_log").insert({ user_id: doc.user_id, function_name: "generate-flashcards" });

    return new Response(JSON.stringify({ success: true, count: cards.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
