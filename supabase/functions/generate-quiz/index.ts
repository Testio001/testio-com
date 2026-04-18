import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_QUIZ_MAX_QUESTIONS_PER_DOC = 20;
const BASIC_QUIZ_MAX_QUESTIONS_PER_DOC = 20;
// Pro & Scholar: unlimited (capped at 200/doc as a safety net)
const UNLIMITED_QUIZ_CAP = 200;

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

async function getActivePlan(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("subscription_plan, subscription_expires_at").eq("user_id", userId).single();
  if (!data) return "free";
  const isActive = ["basic", "pro", "scholar"].includes(data.subscription_plan) &&
    data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() > Date.now();
  return isActive ? data.subscription_plan : "free";
}

function getQuizCapForPlan(plan: string): number {
  if (plan === "free" || plan === "basic") return FREE_QUIZ_MAX_QUESTIONS_PER_DOC;
  return UNLIMITED_QUIZ_CAP;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, count } = await req.json();
    const requestedCount = count || 10;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Enforce per-plan cap on TOTAL questions for this document
    const plan = await getActivePlan(supabase, doc.user_id);
    const cap = getQuizCapForPlan(plan);

    const { data: existingQuizzes } = await supabase.from("quizzes").select("id").eq("document_id", documentId);
    let existingQuestions: string[] = [];
    if (existingQuizzes && existingQuizzes.length > 0) {
      const { data: existing } = await supabase.from("quiz_questions").select("question").in("quiz_id", existingQuizzes.map((q: any) => q.id));
      existingQuestions = existing?.map((q: any) => q.question) || [];
    }

    const remainingCapacity = Math.max(0, cap - existingQuestions.length);
    if (remainingCapacity <= 0) {
      return new Response(
        JSON.stringify({
          error: plan === "free" || plan === "basic"
            ? `You've reached the ${cap}-question limit for this document on the ${plan} plan. Upgrade to Pro or Scholar for unlimited questions.`
            : `You've reached the safety cap of ${cap} questions per document.`,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const questionCount = Math.min(requestedCount, remainingCapacity);

    // Use summary from notes instead of full content
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n");
    const sourceContent = noteContent ? extractSummary(noteContent) : content.substring(0, 4000);

    // No-repeat: pass ALL existing question stems (truncated to ~3000 chars to stay safe)
    const existingJoined = existingQuestions.join("\n");
    const truncatedExisting = existingJoined.length > 3000 ? existingJoined.substring(existingJoined.length - 3000) : existingJoined;
    const avoidPrompt = existingQuestions.length > 0
      ? `\n\nCRITICAL: You MUST generate questions covering DIFFERENT subtopics, angles, or details than the ones in the list below. Do NOT rephrase or repeat any of these — pick fresh angles, different facts, deeper details, or new sections of the material.\n\nALREADY ASKED (do NOT repeat or rephrase):\n${truncatedExisting}`
      : "";

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85, // higher variety to reduce repeats
        messages: [
          { role: "system", content: "Generate a multiple-choice quiz from the study content summary. Cover DIFFERENT angles each time. Return structured data." },
          { role: "user", content: `Create ${questionCount} NEW unique multiple-choice questions from this content summary. Each question should have 4 options with exactly one correct answer and an explanation.${avoidPrompt}\n\nContent Summary:\n${sourceContent}` }
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
    let questions = JSON.parse(toolCall?.function?.arguments || "{}").questions || [];

    // Client-side dedupe pass: drop any question whose stem matches an existing one
    const existingLower = new Set(existingQuestions.map((q: string) => q.toLowerCase().trim()));
    questions = questions.filter((q: any) => !existingLower.has(q.question.toLowerCase().trim()));

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

    return new Response(JSON.stringify({ success: true, count: questions.length, capRemaining: remainingCapacity - questions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
