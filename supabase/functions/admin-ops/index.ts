import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DashboardCounts = {
  totalUsers: number;
  totalUploads: number;
  dailyActiveUsers: number;
  quizzesTotal: number;
  quizzesToday: number;
  flashcardsTotal: number;
  flashcardsToday: number;
  podcastsTotal: number;
  podcastsToday: number;
  paidUsers: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate caller and require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    const { action } = body as { action?: string };

    if (action === "dashboard") {
      const [
        totalUsersRes,
        totalUploadsRes,
        dailyUsersRes,
        quizzesTotalRes,
        quizzesTodayRes,
        flashcardsTotalRes,
        flashcardsTodayRes,
        podcastsTotalRes,
        podcastsTodayRes,
        paidUsersRes,
      ] = await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("ai_usage_log").select("user_id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("flashcard_sets").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("flashcard_sets").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("podcasts").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("podcasts").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).in("subscription_plan", ["basic", "pro", "scholar", "elite"]).gt("subscription_expires_at", new Date().toISOString()),
      ]);

      const errors = [
        totalUsersRes.error,
        totalUploadsRes.error,
        dailyUsersRes.error,
        quizzesTotalRes.error,
        quizzesTodayRes.error,
        flashcardsTotalRes.error,
        flashcardsTodayRes.error,
        podcastsTotalRes.error,
        podcastsTodayRes.error,
        paidUsersRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error("admin-ops dashboard errors", errors);
        return json({ error: "Unable to load dashboard metrics" }, 500);
      }

      const dailyRows = await supabaseAdmin
        .from("ai_usage_log")
        .select("user_id")
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      if (dailyRows.error) {
        console.error("admin-ops daily rows error", dailyRows.error);
        return json({ error: "Unable to load daily active users" }, 500);
      }

      const uniqueDailyUsers = new Set((dailyRows.data ?? []).map((row) => row.user_id)).size;
      const counts: DashboardCounts = {
        totalUsers: totalUsersRes.count ?? 0,
        totalUploads: totalUploadsRes.count ?? 0,
        dailyActiveUsers: uniqueDailyUsers,
        quizzesTotal: quizzesTotalRes.count ?? 0,
        quizzesToday: quizzesTodayRes.count ?? 0,
        flashcardsTotal: flashcardsTotalRes.count ?? 0,
        flashcardsToday: flashcardsTodayRes.count ?? 0,
        podcastsTotal: podcastsTotalRes.count ?? 0,
        podcastsToday: podcastsTodayRes.count ?? 0,
        paidUsers: paidUsersRes.count ?? 0,
      };

      const rate = counts.totalUsers > 0 ? (counts.paidUsers / counts.totalUsers) * 100 : 0;

      return json({
        totalUsers: counts.totalUsers,
        totalUploads: counts.totalUploads,
        dailyActiveUsers: counts.dailyActiveUsers,
        featureUsage: {
          quizzes: { total: counts.quizzesTotal, today: counts.quizzesToday },
          flashcards: { total: counts.flashcardsTotal, today: counts.flashcardsToday },
          podcasts: { total: counts.podcastsTotal, today: counts.podcastsToday },
        },
        conversions: {
          paidUsers: counts.paidUsers,
          rate,
        },
      });
    }

    if (action === "lookup-user") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!email) return json({ error: "Email is required" }, 400);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("admin-ops lookup error", error);
        return json({ error: "Unable to look up user" }, 500);
      }

      if (!data?.user_id) return json(null);

      const { data: stats, error: statsError } = await supabaseAdmin
        .from("user_stats")
        .select("current_streak, longest_streak")
        .eq("user_id", data.user_id)
        .maybeSingle();

      if (statsError) {
        console.error("admin-ops stats lookup error", statsError);
        return json({ error: "Unable to load streak data" }, 500);
      }

      return json({
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
        current_streak: stats?.current_streak ?? 0,
        longest_streak: stats?.longest_streak ?? 0,
      });
    }

    if (action === "set-streak") {
      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
      const streak = Number(body.streak);
      if (!targetUserId || !Number.isInteger(streak) || streak < 0) {
        return json({ error: "Valid target user and streak are required" }, 400);
      }

      const { data: currentStats, error: currentStatsError } = await supabaseAdmin
        .from("user_stats")
        .select("current_streak, longest_streak")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (currentStatsError || !currentStats) {
        console.error("admin-ops current stats error", currentStatsError);
        return json({ error: "User stats not found" }, 404);
      }

      const { error: updateError } = await supabaseAdmin
        .from("user_stats")
        .update({
          current_streak: streak,
          longest_streak: Math.max(currentStats.longest_streak ?? 0, streak),
          last_upload_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId);

      if (updateError) {
        console.error("admin-ops update streak error", updateError);
        return json({ error: "Unable to update streak" }, 500);
      }

      return json({ success: true });
    }

    if (action === "referrals") {
      // Get all referrals
      const { data: refs, error: refErr } = await supabaseAdmin
        .from("referrals")
        .select("referrer_user_id, referred_user_id, created_at")
        .order("created_at", { ascending: false });

      if (refErr) {
        console.error("admin-ops referrals error", refErr);
        return json({ error: "Unable to load referrals" }, 500);
      }

      const userIds = Array.from(
        new Set((refs ?? []).flatMap((r) => [r.referrer_user_id, r.referred_user_id])),
      );

      const profilesMap = new Map<string, { email: string | null; display_name: string | null; subscription_plan: string; subscription_expires_at: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email, display_name, subscription_plan, subscription_expires_at")
          .in("user_id", userIds);
        for (const p of profs ?? []) {
          profilesMap.set(p.user_id, {
            email: p.email,
            display_name: p.display_name,
            subscription_plan: p.subscription_plan,
            subscription_expires_at: p.subscription_expires_at,
          });
        }
      }

      const nowIso = new Date().toISOString();
      const isPaid = (uid: string) => {
        const p = profilesMap.get(uid);
        if (!p) return false;
        if (!["basic", "pro", "scholar", "elite"].includes(p.subscription_plan)) return false;
        return !!p.subscription_expires_at && p.subscription_expires_at > nowIso;
      };

      const rows = (refs ?? []).map((r) => {
        const referrer = profilesMap.get(r.referrer_user_id);
        const referred = profilesMap.get(r.referred_user_id);
        return {
          created_at: r.created_at,
          referrer_user_id: r.referrer_user_id,
          referrer_email: referrer?.email ?? null,
          referrer_name: referrer?.display_name ?? null,
          referred_user_id: r.referred_user_id,
          referred_email: referred?.email ?? null,
          referred_name: referred?.display_name ?? null,
          referred_plan: referred?.subscription_plan ?? "free",
          referred_is_paid: isPaid(r.referred_user_id),
        };
      });

      // Aggregate by referrer
      const agg = new Map<string, { user_id: string; email: string | null; name: string | null; total: number; paid: number }>();
      for (const row of rows) {
        const cur = agg.get(row.referrer_user_id) ?? {
          user_id: row.referrer_user_id,
          email: row.referrer_email,
          name: row.referrer_name,
          total: 0,
          paid: 0,
        };
        cur.total += 1;
        if (row.referred_is_paid) cur.paid += 1;
        agg.set(row.referrer_user_id, cur);
      }
      const topReferrers = Array.from(agg.values()).sort((a, b) => b.paid - a.paid || b.total - a.total);

      return json({
        totalReferrals: rows.length,
        paidReferrals: rows.filter((r) => r.referred_is_paid).length,
        topReferrers,
        rows: rows.slice(0, 200),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-ops error", error);
    return json({ error: "An internal error occurred" }, 500);
  }
});