import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with active streaks
    const { data: activeStreaks } = await supabase
      .from("user_stats")
      .select("user_id, current_streak, last_upload_date, streak_freezes")
      .gt("current_streak", 0);

    if (!activeStreaks || activeStreaks.length === 0) {
      return new Response(JSON.stringify({ message: "No active streaks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let notified = 0;

    for (const user of activeStreaks) {
      if (!user.last_upload_date) continue;

      const lastUpload = new Date(user.last_upload_date);
      lastUpload.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24));

      // If they haven't uploaded today, their streak is at risk
      if (diffDays >= 1) {
        // Get user email from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", user.user_id)
          .single();

        if (profile?.email) {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const freezeNote = user.streak_freezes > 0
              ? `You have ${user.streak_freezes} Streak Freeze${user.streak_freezes > 1 ? "s" : ""} to protect you!`
              : "Refer a friend to earn a Streak Freeze!";

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Testio <noreply@notify.testio.online>",
                to: [profile.email],
                subject: `🔥 Your ${user.current_streak}-day streak is at risk!`,
                html: `
                  <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #1a1a1a;">Hey ${profile.display_name || "there"}! 👋</h2>
                    <p style="color: #4a4a4a; line-height: 1.6;">
                      Your <strong>${user.current_streak}-day streak</strong> is at risk! 
                      Take a quick 2-minute quiz or upload a note to keep it alive.
                    </p>
                    <p style="color: #4a4a4a; line-height: 1.6;">${freezeNote}</p>
                    <a href="https://testio.online/dashboard" 
                       style="display: inline-block; background: linear-gradient(135deg, #30b8a0, #40d0b0); color: #0a0c10; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                      Keep My Streak 🔥
                    </a>
                  </div>
                `,
              }),
            });
            notified++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
