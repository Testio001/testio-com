import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    const userEmail = user.email;

    // Capture the user's plan BEFORE we delete it, so we can record it in account_history
    let lastPlan = "free";
    if (userEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("user_id", userId)
        .single();
      if (profile?.subscription_plan) lastPlan = profile.subscription_plan;
    }

    // Delete all user data in order (respecting foreign keys)
    await supabase.from("chat_messages").delete().eq("user_id", userId);

    const { data: flashcardSets } = await supabase.from("flashcard_sets").select("id").eq("user_id", userId);
    if (flashcardSets && flashcardSets.length > 0) {
      await supabase.from("flashcard_cards").delete().in("flashcard_set_id", flashcardSets.map(s => s.id));
    }
    await supabase.from("flashcard_sets").delete().eq("user_id", userId);

    const { data: quizzes } = await supabase.from("quizzes").select("id").eq("user_id", userId);
    if (quizzes && quizzes.length > 0) {
      await supabase.from("quiz_questions").delete().in("quiz_id", quizzes.map(q => q.id));
    }
    await supabase.from("quizzes").delete().eq("user_id", userId);

    await supabase.from("notes").delete().eq("user_id", userId);
    await supabase.from("documents").delete().eq("user_id", userId);

    // Capture device fingerprints BEFORE we wipe them, to remember the device in account_history
    const { data: fps } = await supabase
      .from("device_fingerprints")
      .select("fingerprint")
      .eq("user_id", userId);
    const primaryFp = fps && fps.length > 0 ? fps[0].fingerprint : null;
    await supabase.from("device_fingerprints").delete().eq("user_id", userId);

    await supabase.from("profiles").delete().eq("user_id", userId);

    // Record account history BEFORE deleting auth user — so re-signups can't reclaim free trial
    if (userEmail) {
      try {
        const emailHash = await hashEmail(userEmail);
        await supabase.from("account_history").insert({
          email_hash: emailHash,
          email_lower: userEmail.toLowerCase().trim(),
          last_plan: lastPlan,
          device_fingerprint: primaryFp,
        });
        console.log(`Recorded account_history for ${userEmail}`);
      } catch (e) {
        console.error("Failed to record account_history:", e);
      }
    }

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    // Send account deletion confirmation email
    if (userEmail) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "account-deleted",
            recipientEmail: userEmail,
            idempotencyKey: `account-deleted-${userId}`,
          },
        });
      } catch (e) {
        console.error("Failed to send account deletion email:", e);
      }
    }

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
