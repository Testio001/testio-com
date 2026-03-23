import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_UPLOAD_LIMIT = 3;
const MAX_REFERRALS_PER_MONTH = 5;
const STREAK_BONUS_INTERVAL = 10;

const BADGE_DEFINITIONS = [
  { type: "streak_3", name: "The 3-Day Starter", threshold: 3 },
  { type: "streak_7", name: "The 7-Day Scholar", threshold: 7 },
  { type: "streak_14", name: "The 14-Day Achiever", threshold: 14 },
  { type: "streak_30", name: "The 30-Day Dean's List", threshold: 30 },
  { type: "streak_60", name: "The 60-Day Legend", threshold: 60 },
  { type: "streak_100", name: "The 100-Day Master", threshold: 100 },
];

function generateReferralCode(): string {
  return "testio-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, ...params } = await req.json();

    // Helper: get or create user stats
    async function getOrCreateStats() {
      let { data: stats } = await supabaseAdmin
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!stats) {
        const code = generateReferralCode();
        const { data: newStats } = await supabaseAdmin
          .from("user_stats")
          .insert({ user_id: userId, referral_code: code })
          .select()
          .single();
        stats = newStats;
      }
      return stats;
    }

    // Helper: reset monthly referrals if needed
    async function maybeResetMonthlyReferrals(stats: any) {
      const resetDate = new Date(stats.referrals_month_reset);
      const now = new Date();
      const monthDiff =
        (now.getFullYear() - resetDate.getFullYear()) * 12 +
        now.getMonth() -
        resetDate.getMonth();
      if (monthDiff >= 1) {
        const today = now.toISOString().split("T")[0];
        await supabaseAdmin
          .from("user_stats")
          .update({ referrals_this_month: 0, referrals_month_reset: today })
          .eq("user_id", userId);
        stats.referrals_this_month = 0;
        stats.referrals_month_reset = today;
      }
      return stats;
    }

    // Helper: check and handle streak break
    async function checkStreakBreak(stats: any) {
      if (stats.last_upload_date) {
        const lastUpload = new Date(stats.last_upload_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastUpload.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (today.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays > 1) {
          if (diffDays === 2 && stats.streak_freezes > 0) {
            await supabaseAdmin
              .from("user_stats")
              .update({ streak_freezes: stats.streak_freezes - 1 })
              .eq("user_id", userId);
            stats.streak_freezes -= 1;
          } else {
            await supabaseAdmin
              .from("user_stats")
              .update({ current_streak: 0 })
              .eq("user_id", userId);
            stats.current_streak = 0;
          }
        }
      }
      return stats;
    }

    let result: any;

    switch (action) {
      case "get-stats": {
        let stats = await getOrCreateStats();
        if (!stats) throw new Error("Could not create user stats");
        stats = await maybeResetMonthlyReferrals(stats);
        stats = await checkStreakBreak(stats);

        const { data: badges } = await supabaseAdmin
          .from("user_badges")
          .select("*")
          .eq("user_id", userId)
          .order("earned_at", { ascending: true });

        const { data: referrals } = await supabaseAdmin
          .from("referrals")
          .select("*")
          .eq("referrer_user_id", userId)
          .order("created_at", { ascending: false });

        const totalUploadsAllowed = FREE_UPLOAD_LIMIT + (stats.bonus_uploads || 0);
        const uploadsRemaining = Math.max(0, totalUploadsAllowed - (stats.uploads_used || 0));

        result = {
          stats,
          badges: badges || [],
          referrals: referrals || [],
          totalUploadsAllowed,
          uploadsRemaining,
          canUpload: uploadsRemaining > 0,
          referralsRemaining: MAX_REFERRALS_PER_MONTH - (stats.referrals_this_month || 0),
          canRefer: (MAX_REFERRALS_PER_MONTH - (stats.referrals_this_month || 0)) > 0,
        };
        break;
      }

      case "record-upload": {
        let stats = await getOrCreateStats();
        if (!stats) throw new Error("Could not create user stats");
        stats = await maybeResetMonthlyReferrals(stats);
        stats = await checkStreakBreak(stats);

        // Race condition prevention: re-read fresh stats
        const { data: freshStats } = await supabaseAdmin
          .from("user_stats")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!freshStats) throw new Error("Stats not found");

        const today = new Date().toISOString().split("T")[0];
        const isNewDay = freshStats.last_upload_date !== today;
        const newStreak = isNewDay
          ? freshStats.current_streak + 1
          : freshStats.current_streak;
        const newLongest = Math.max(newStreak, freshStats.longest_streak);

        let bonusIncrease = 0;
        if (isNewDay && newStreak > 0 && newStreak % STREAK_BONUS_INTERVAL === 0) {
          bonusIncrease = 1;
        }

        await supabaseAdmin
          .from("user_stats")
          .update({
            uploads_used: freshStats.uploads_used + 1,
            current_streak: newStreak,
            longest_streak: newLongest,
            last_upload_date: today,
            bonus_uploads: freshStats.bonus_uploads + bonusIncrease,
          })
          .eq("user_id", userId);

        // Award badges
        if (isNewDay) {
          const { data: existingBadges } = await supabaseAdmin
            .from("user_badges")
            .select("badge_type")
            .eq("user_id", userId);

          const existingTypes = new Set(
            (existingBadges || []).map((b: any) => b.badge_type)
          );

          for (const badge of BADGE_DEFINITIONS) {
            if (newStreak >= badge.threshold && !existingTypes.has(badge.type)) {
              await supabaseAdmin.from("user_badges").insert({
                user_id: userId,
                badge_type: badge.type,
                badge_name: badge.name,
              });
            }
          }
        }

        result = { bonusEarned: bonusIncrease > 0, newStreak, isNewDay };
        break;
      }

      case "process-referral": {
        const { referralCode } = params;
        if (!referralCode) {
          result = { success: false, message: "No referral code provided" };
          break;
        }

        // Check if already referred
        const { data: existing } = await supabaseAdmin
          .from("referrals")
          .select("id")
          .eq("referred_user_id", userId)
          .single();

        if (existing) {
          result = { success: false, message: "Already used a referral" };
          break;
        }

        // Find referrer
        const { data: referrer } = await supabaseAdmin
          .from("user_stats")
          .select("user_id, referrals_this_month, bonus_uploads, streak_freezes")
          .eq("referral_code", referralCode)
          .single();

        if (!referrer) {
          result = {
            success: false,
            message: "This referral code doesn't exist. Double-check and try again.",
          };
          break;
        }

        if (referrer.user_id === userId) {
          result = { success: false, message: "Cannot refer yourself" };
          break;
        }

        // Check referrer monthly limit
        if (referrer.referrals_this_month >= MAX_REFERRALS_PER_MONTH) {
          result = {
            success: false,
            message: "Referrer has reached their monthly limit",
          };
          break;
        }

        // Create referral
        await supabaseAdmin.from("referrals").insert({
          referrer_user_id: referrer.user_id,
          referred_user_id: userId,
        });

        // Reward referrer atomically
        await supabaseAdmin
          .from("user_stats")
          .update({
            bonus_uploads: referrer.bonus_uploads + 1,
            streak_freezes: referrer.streak_freezes + 1,
            referrals_this_month: referrer.referrals_this_month + 1,
          })
          .eq("user_id", referrer.user_id);

        // Reward referred user
        const myStats = await getOrCreateStats();
        if (myStats) {
          await supabaseAdmin
            .from("user_stats")
            .update({ bonus_uploads: myStats.bonus_uploads + 1 })
            .eq("user_id", userId);
        }

        result = {
          success: true,
          message: "Referral applied! You earned 1 bonus upload.",
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("manage-gamification error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
