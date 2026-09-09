import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendPush(supabase: any, userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: { user_id: userId, payload }
    });
  } catch (e) {
    console.error(`[Push] Failed for ${userId}:`, e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all users with active streaks (streak at risk)
    const { data: activeStreaks } = await supabase
      .from("user_stats")
      .select("user_id, current_streak, last_upload_date, streak_freezes")
      .gt("current_streak", 0);

    // Get all users who haven't uploaded in 3+ days (idle reminder)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

    const { data: idleUsers } = await supabase
      .from("user_stats")
      .select("user_id, last_upload_date")
      .lte("last_upload_date", threeDaysAgoStr);

    let notified = 0;
    let idleNotified = 0;
    let pushSent = 0;

    // Streak at-risk notifications (email + push)
    if (activeStreaks) {
      for (const user of activeStreaks) {
        if (!user.last_upload_date) continue;

        const lastUpload = new Date(user.last_upload_date);
        lastUpload.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24));

        // Email/push at most once every 5 days per user (day 5, 10, 15...)
        const shouldRemind = diffDays >= 5 && diffDays % 5 === 0;

        if (shouldRemind) {
          // Send push notification
          await sendPush(supabase, user.user_id, {
            title: "🔥 Keep the streak alive!",
            body: "Don't break your momentum. Take a quick 5-question quiz on your last upload to lock in that knowledge.",
            url: "/dashboard"
          });
          pushSent++;

          const { data: profile } = await supabase
            .from("profiles")
            .select("email, display_name")
            .eq("user_id", user.user_id)
            .single();

          if (profile?.email) {
            const freezeNote = user.streak_freezes > 0
              ? `You have ${user.streak_freezes} Streak Freeze${user.streak_freezes > 1 ? "s" : ""} to protect you!`
              : "Refer a friend to earn a Streak Freeze!";

            try {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "idle-reminder",
                  recipientEmail: profile.email,
                  idempotencyKey: `streak-risk-${user.user_id}-${today.toISOString().split("T")[0]}`,
                  templateData: {
                    displayName: profile.display_name || profile.email.split("@")[0],
                    headline: `Your ${user.current_streak}-day streak is at risk!`,
                    note: freezeNote,
                  },
                },
              });
              notified++;
            } catch (e) {
              console.error("Failed to send streak-at-risk email:", e);
            }
          }
        }
      }
    }

    // Idle reminder (3+ days no upload) — email + push
    if (idleUsers) {
      for (const user of idleUsers) {
        const alreadyNotified = activeStreaks?.some(s => s.user_id === user.user_id);
        if (alreadyNotified) continue;

        // Send re-engagement push
        await sendPush(supabase, user.user_id, {
          title: "📝 Time to study!",
          body: "Upload your syllabus today and let Testio create a study plan for you.",
          url: "/dashboard"
        });
        pushSent++;

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", user.user_id)
          .single();

        if (profile?.email) {
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "idle-reminder",
                recipientEmail: profile.email,
                idempotencyKey: `idle-reminder-${user.user_id}-${today.toISOString().split("T")[0]}`,
                templateData: {
                  displayName: profile.display_name || profile.email.split("@")[0],
                },
              },
            });
            idleNotified++;
          } catch (e) {
            console.error("Failed to send idle reminder:", e);
          }
        }
      }
    }

    // Random study reminder push — pick random users who uploaded in last 7 days but not today
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: recentUsers } = await supabase
      .from("user_stats")
      .select("user_id")
      .gte("last_upload_date", sevenDaysAgoStr)
      .neq("last_upload_date", todayStr)
      .limit(20);

    if (recentUsers) {
      const studyMessages = [
        { title: "📝 Midterms approaching?", body: "Upload your syllabus today and let Testio create a 14-day study plan for you." },
        { title: "💡 Quick study session?", body: "Review your flashcards for 5 minutes. Small steps lead to big results!" },
        { title: "🧠 Knowledge check!", body: "Take a quick quiz on your last upload. It only takes 2 minutes!" },
      ];
      const msg = studyMessages[Math.floor(Math.random() * studyMessages.length)];
      for (const u of recentUsers) {
        await sendPush(supabase, u.user_id, { ...msg, url: "/dashboard" });
        pushSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified, idleNotified, pushSent }),
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
