import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { documentId, count } = await req.json();
    const questionCount = count || 10;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Verify ownership
    if (doc.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use notes only if not corrupted
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n");
    const sourceContent = (noteContent && noteContent.length > content.length) ? noteContent : content;

    const { data: existingQuizzes } = await supabase.from("quizzes").select("id").eq("document_id", documentId);
    let existingQuestions: string[] = [];
    if (existingQuizzes && existingQuizzes.length > 0) {
      const { data: existing } = await supabase.from("quiz_questions").select("question").in("quiz_id", existingQuizzes.map((q: any) => q.id));
      existingQuestions = existing?.map((q: any) => q.question) || [];
    }

    const avoidPrompt = existingQuestions.length > 0
      ? `\n\nIMPORTANT: Do NOT repeat these existing questions:\n${existingQuestions.slice(-30).join("\n")}`
      : "";

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Generate a multiple-choice quiz from the study content. Return structured data." },
          { role: "user", content: `Create ${questionCount} NEW unique multiple-choice questions from this content. Each question should have 4 options with exactly one correct answer and an explanation.${avoidPrompt}\n\nContent:\n${sourceContent.substring(0, 12000)}` }
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
                      options: { type: "array", items: { type: "object", properties: { text: { type: "string" }, isCorrect: { type: "boolean" } }, required: ["text", "isCorrect"], additionalProperties: false } },
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
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Quiz generation failed. Please try again.");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const questions = JSON.parse(toolCall?.function?.arguments || "{}").questions || [];

    const { data: quiz } = await supabase.from("quizzes").insert({
      user_id: doc.user_id, document_id: documentId, title: `Quiz: ${doc.title}`,
    }).select().single();

    if (quiz && questions.length > 0) {
      const startIndex = existingQuestions.length;
      await supabase.from("quiz_questions").insert(
        questions.map((q: any, i: number) => ({
          quiz_id: quiz.id, question: q.question, options: q.options, explanation: q.explanation, order_index: startIndex + i,
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, count: questions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
