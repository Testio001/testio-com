import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const userId = user.id;

    // Delete all user data in order (respecting foreign keys)
    await supabase.from("chat_messages").delete().eq("user_id", userId);
    
    // Get user's flashcard sets and delete cards first
    const { data: flashcardSets } = await supabase.from("flashcard_sets").select("id").eq("user_id", userId);
    if (flashcardSets && flashcardSets.length > 0) {
      await supabase.from("flashcard_cards").delete().in("flashcard_set_id", flashcardSets.map(s => s.id));
    }
    await supabase.from("flashcard_sets").delete().eq("user_id", userId);

    // Get user's quizzes and delete questions first
    const { data: quizzes } = await supabase.from("quizzes").select("id").eq("user_id", userId);
    if (quizzes && quizzes.length > 0) {
      await supabase.from("quiz_questions").delete().in("quiz_id", quizzes.map(q => q.id));
    }
    await supabase.from("quizzes").delete().eq("user_id", userId);

    await supabase.from("notes").delete().eq("user_id", userId);
    await supabase.from("documents").delete().eq("user_id", userId);
    
    await supabase.from("profiles").delete().eq("user_id", userId);

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
