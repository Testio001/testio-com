import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCESS_CODE = "4171";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    const { action, code } = body as { action?: string; code?: string };
    if (code !== ACCESS_CODE) return json({ error: "Invalid code" }, 403);

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

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-ops error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});