import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent } from "../_shared/extract-content.ts";
import { getAuthedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthedUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { documentId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get validated content using shared helper (auto re-extracts if needed)
    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);
    if (doc.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existingNote } = await supabase
      .from("notes")
      .select("id")
      .eq("document_id", documentId)
      .maybeSingle();
    if (existingNote) {
      return new Response(JSON.stringify({ success: true, alreadyExists: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are an elite study notes designer. Output ONLY valid GitHub-Flavored Markdown. NO plain prose walls. Every note must look like a premium $20 study guide.

MANDATORY STRUCTURE (in this order, every time):

1. ONE main title: "# <emoji> <Topic Name>"  — single line, no other text on it.
2. A SHORT blockquote intro (1–3 sentences) immediately under the title:
   > **<Topic name>** is/involves ... <one or two more sentences>.
3. "## <emoji> Brief Overview" — 2–3 sentence paragraph.
4. "## <emoji> Key Points" — 4–7 bullet points, each starting with **Bold Term**: explanation.
5. For EACH major sub-topic, an "## <emoji> <Section Name>" heading.
6. Whenever the content has comparisons, categories, methods, types, features, examples, pros/cons, or anything with 2+ attributes per item — RENDER A MARKDOWN TABLE. Tables are required, not optional.
7. Use "> blockquote" for every definition and every important statement.
8. Use "---" horizontal rule between major top-level sections (between ## blocks).
9. Use "### Sub-section" inside major sections when helpful.
10. Bold (**term**) EVERY key term, name, technology, methodology, concept, and proper noun on first mention AND in table cells.
11. Use "1. 2. 3." numbered lists for processes, steps, lifecycles, sequences.
12. Use code blocks (\`\`\`) for formulas, code, or commands.

HARD RULES:
- NEVER output a flat run of paragraphs. Break every topic into headings + lists + tables + blockquotes.
- ALWAYS leave ONE blank line before AND after every heading, list, table, and blockquote. Spacing is mandatory for readability.
- NEVER use bold paragraphs (e.g. "**Brief Overview**") in place of a real "## " heading. Section titles MUST be true markdown headings.
- NEVER skip the blockquote intro under the H1.
- NEVER use a plain paragraph where a list or table would communicate better.
- EVERY ## heading MUST start with a relevant emoji (📚 💻 🧠 ⚙️ 🔬 📊 🧪 🏛 ⚖️ 💡 🎯 📈 🩺 etc.).
- Bolded text is the visual rhythm of the page — use it generously on key nouns and terms.
- Tables MUST have a header row and at least 2 data rows. Bold the first column.
- Cover EVERY topic in the source content thoroughly — do not summarize away detail.

Subject hints:
  Science/Engineering → comparison tables, numbered process steps, code blocks for formulas.
  Law/History → blockquotes for cases/rulings, chronological numbered timelines, tables for parties/dates.
  Mathematics → numbered solution steps, code blocks for equations, tables of formulas.
  Business/Economics → comparison tables, framework bullets, blockquotes for principles.
  Medicine/Biology → tables for symptoms/treatments, numbered procedure steps, blockquotes for definitions.

Output ONLY the markdown. No preamble, no closing remarks.`
          },
          {
            role: "user",
            content: `Generate detailed study notes from the following content:\n\n${content.substring(0, 20000)}`
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

    const { error: insertError } = await supabase.from("notes").insert({
      user_id: doc.user_id,
      document_id: documentId,
      title: `Notes: ${doc.title}`,
      content: notesContent,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ success: true, alreadyExists: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw insertError;
    }

    await supabase.from("documents").update({ status: "completed" }).eq("id", documentId);

    // Log successful AI usage for rate limiting
    await supabase.from("ai_usage_log").insert({ user_id: doc.user_id, function_name: "generate-notes" });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
