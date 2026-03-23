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
    const { documentId, count } = await req.json();
    const cardCount = count || 15;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get validated content - NO title fallback
    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Also check notes for richer content
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).join("\n");
    const sourceContent = (noteContent && noteContent.length > content.length) ? noteContent : content;

    // Get existing cards to avoid duplicates
    const { data: existingSets } = await supabase.from("flashcard_sets").select("id").eq("document_id", documentId);
    let existingFronts: string[] = [];
    if (existingSets && existingSets.length > 0) {
      const { data: existing } = await supabase.from("flashcard_cards").select("front").in("flashcard_set_id", existingSets.map((s: any) => s.id));
      existingFronts = existing?.map((c: any) => c.front) || [];
    }

    const avoidPrompt = existingFronts.length > 0
      ? `\n\nIMPORTANT: Do NOT repeat these existing flashcard questions:\n${existingFronts.slice(-30).join("\n")}`
      : "";

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Generate flashcards from the provided study content. Return ONLY valid JSON." },
          { role: "user", content: `Create ${cardCount} NEW unique flashcards from this content. Return JSON array with objects having "front" (question) and "back" (answer) fields.${avoidPrompt}\n\nContent:\n${sourceContent.substring(0, 12000)}` }
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
    const cards = JSON.parse(toolCall?.function?.arguments || "{}").cards || [];

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

    return new Response(JSON.stringify({ success: true, count: cards.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
