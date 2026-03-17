import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (!doc) throw new Error("Document not found");

    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map(n => n.content).join("\n") || doc.original_content || doc.title;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Generate a multiple-choice quiz from the study content. Return structured data."
          },
          {
            role: "user",
            content: `Create a 10-question multiple-choice quiz from this content. Each question should have 4 options with exactly one correct answer and an explanation:\n\n${noteContent.substring(0, 12000)}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_quiz",
            description: "Create a multiple-choice quiz",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            isCorrect: { type: "boolean" }
                          },
                          required: ["text", "isCorrect"],
                          additionalProperties: false
                        }
                      },
                      explanation: { type: "string" }
                    },
                    required: ["question", "options", "explanation"],
                    additionalProperties: false
                  }
                }
              },
              required: ["questions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_quiz" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const questions = JSON.parse(toolCall?.function?.arguments || "{}").questions || [];

    const { data: quiz } = await supabase.from("quizzes").insert({
      user_id: doc.user_id,
      document_id: documentId,
      title: `Quiz: ${doc.title}`,
    }).select().single();

    if (quiz && questions.length > 0) {
      await supabase.from("quiz_questions").insert(
        questions.map((q: any, i: number) => ({
          quiz_id: quiz.id,
          question: q.question,
          options: q.options,
          explanation: q.explanation,
          order_index: i,
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, count: questions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
