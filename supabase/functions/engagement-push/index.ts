// Sends one push notification per subscribed user, 3 times a day
// (slot = morning | afternoon | evening). The message type is chosen from the
// user's situation so people get relevant reasons to come back.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Msg = { title: string; body: string; url: string };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const DAY = 86400000;

function choose(slot: string, p: any, s: any): Msg {
  const now = Date.now();
  const plan = p?.subscription_plan ?? "free";
  const exp = p?.subscription_expires_at ? new Date(p.subscription_expires_at).getTime() : 0;
  const paid = plan !== "free" && exp > now;
  const daysLeft = paid ? Math.ceil((exp - now) / DAY) : 0;
  const lastUpload = s?.last_upload_date ? new Date(s.last_upload_date).getTime() : 0;
  const idleDays = lastUpload ? Math.floor((now - lastUpload) / DAY) : 999;
  const streak = s?.current_streak ?? 0;

  // 1) Plan about to end → renewal reminder
  if (paid && daysLeft <= 3) {
    return { title: `⏳ Your ${plan} plan ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, body: "Renew now so your uploads, podcasts and quizzes keep working.", url: "/pricing" };
  }
  // 2) Plan expired recently → win-back payment reminder
  if (plan !== "free" && exp && exp <= now && now - exp < 14 * DAY) {
    return { title: "💳 Your plan has ended", body: "Pick up where you left off — renew in seconds and get your full access back.", url: "/pricing" };
  }
  // 3) Streak at risk (evening only)
  if (slot === "evening" && streak > 0 && idleDays >= 1) {
    return { title: `🔥 Don't lose your ${streak}-day streak`, body: "Upload or review a note before midnight to keep it alive.", url: "/dashboard" };
  }

  const pools: Record<string, Msg[]> = {
    morning: [
      { title: "☀️ Good morning, scholar", body: "5 minutes of flashcards now saves an hour of cramming later.", url: "/dashboard" },
      { title: "🎧 Study on the go", body: "Turn your notes into a podcast and listen on your way.", url: "/dashboard" },
      { title: "📚 Today's quick win", body: "Take a 5-question quiz on your last document.", url: "/dashboard" },
    ],
    afternoon: [
      { title: "🧠 Quick brain check", body: "Can you still answer your last quiz? Try it now.", url: "/dashboard" },
      { title: "🎬 Earn Testio for free", body: "Post a video about Testio and unlock a free Starter, Basic or Pro month.", url: "/creator-rewards" },
      { title: "🎁 Invite a friend", body: "Share your link — when they upgrade, you get +1 upload and a streak freeze.", url: "/dashboard" },
    ],
    evening: [
      { title: "🌙 Wind down with a review", body: "Flip through your flashcards before bed — it helps memory stick.", url: "/dashboard" },
      { title: "📝 Got lecture notes today?", body: "Upload them and get notes, quizzes and flashcards instantly.", url: "/dashboard" },
    ],
  };
  if (!paid) {
    pools.afternoon.push({ title: "🚀 Unlock more uploads", body: "Upgrade to get more uploads, full podcasts and unlimited AI chat.", url: "/pricing" });
  }
  if (idleDays >= 3 && idleDays < 999) {
    return pick([
      { title: "👋 We miss you!", body: "Your study tools are waiting. Jump back in for 5 minutes.", url: "/dashboard" },
      { title: "📈 Exams sneak up fast", body: "Upload one document today and stay ahead.", url: "/dashboard" },
    ]);
  }
  return pick(pools[slot] ?? pools.afternoon);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { slot = "afternoon" } = await req.json().catch(() => ({}));
    if (!["morning", "afternoon", "evening"].includes(slot)) {
      return new Response(JSON.stringify({ error: "invalid slot" }), { status: 400, headers: cors });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: subs } = await admin.from("push_subscriptions").select("user_id").limit(5000);
    const userIds = [...new Set((subs ?? []).map((r: any) => r.user_id))];
    let sent = 0;

    for (let i = 0; i < userIds.length; i += 100) {
      const batch = userIds.slice(i, i + 100);
      const [{ data: profiles }, { data: stats }] = await Promise.all([
        admin.from("profiles").select("user_id, subscription_plan, subscription_expires_at").in("user_id", batch),
        admin.from("user_stats").select("user_id, current_streak, last_upload_date").in("user_id", batch),
      ]);
      for (const uid of batch) {
        const msg = choose(slot, profiles?.find((p: any) => p.user_id === uid), stats?.find((s: any) => s.user_id === uid));
        try {
          await admin.functions.invoke("send-push-notification", { body: { user_id: uid, payload: msg } });
          sent++;
        } catch (e) {
          console.error("push failed", uid, e);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, slot, users: userIds.length, sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
