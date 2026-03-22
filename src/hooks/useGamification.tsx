import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserStats {
  id: string;
  user_id: string;
  uploads_used: number;
  bonus_uploads: number;
  current_streak: number;
  longest_streak: number;
  last_upload_date: string | null;
  streak_freezes: number;
  referral_code: string;
  referrals_this_month: number;
  referrals_month_reset: string;
}

export interface Badge {
  id: string;
  badge_type: string;
  badge_name: string;
  earned_at: string;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  created_at: string;
}

const FREE_UPLOAD_LIMIT = 3;
const MAX_REFERRALS_PER_MONTH = 5;
const FREE_PODCAST_MAX_EXCHANGES = 8; // ~3 mins
const FREE_QUIZ_MAX_QUESTIONS = 20;
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

export function useGamification() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    // Fetch or create user_stats
    let { data: statsData } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!statsData) {
      const code = generateReferralCode();
      const { data: newStats } = await supabase
        .from("user_stats")
        .insert({ user_id: user.id, referral_code: code })
        .select()
        .single();
      statsData = newStats;
    }

    if (statsData) {
      // Reset monthly referrals if needed
      const resetDate = new Date(statsData.referrals_month_reset);
      const now = new Date();
      const monthDiff = (now.getFullYear() - resetDate.getFullYear()) * 12 + now.getMonth() - resetDate.getMonth();
      if (monthDiff >= 1) {
        const today = now.toISOString().split("T")[0];
        await supabase.from("user_stats").update({
          referrals_this_month: 0,
          referrals_month_reset: today,
        }).eq("user_id", user.id);
        statsData.referrals_this_month = 0;
        statsData.referrals_month_reset = today;
      }

      // Check streak - if last_upload_date is more than 1 day ago, streak may be broken
      if (statsData.last_upload_date) {
        const lastUpload = new Date(statsData.last_upload_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastUpload.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          // Use streak freeze if available
          if (diffDays === 2 && statsData.streak_freezes > 0) {
            await supabase.from("user_stats").update({
              streak_freezes: statsData.streak_freezes - 1,
            }).eq("user_id", user.id);
            statsData.streak_freezes -= 1;
          } else if (diffDays > 1) {
            // Streak broken
            await supabase.from("user_stats").update({
              current_streak: 0,
            }).eq("user_id", user.id);
            statsData.current_streak = 0;
          }
        }
      }

      setStats(statsData as UserStats);
    }

    // Fetch badges
    const { data: badgeData } = await supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: true });
    setBadges((badgeData || []) as Badge[]);

    // Fetch referrals
    const { data: refData } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });
    setReferrals((refData || []) as Referral[]);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalUploadsAllowed = FREE_UPLOAD_LIMIT + (stats?.bonus_uploads || 0);
  const uploadsRemaining = Math.max(0, totalUploadsAllowed - (stats?.uploads_used || 0));
  const canUpload = uploadsRemaining > 0;
  const referralsRemaining = MAX_REFERRALS_PER_MONTH - (stats?.referrals_this_month || 0);
  const canRefer = referralsRemaining > 0;

  // Days until next referral reset
  const daysUntilReferralReset = (() => {
    if (!stats) return 0;
    const resetDate = new Date(stats.referrals_month_reset);
    resetDate.setMonth(resetDate.getMonth() + 1);
    const diff = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const recordUpload = async () => {
    if (!user || !stats) return;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = stats.last_upload_date !== today;
    const newStreak = isNewDay ? stats.current_streak + 1 : stats.current_streak;
    const newLongest = Math.max(newStreak, stats.longest_streak);

    // Check for streak bonus (every 10 days = 1 bonus upload)
    let bonusIncrease = 0;
    if (isNewDay && newStreak > 0 && newStreak % STREAK_BONUS_INTERVAL === 0) {
      bonusIncrease = 1;
    }

    await supabase.from("user_stats").update({
      uploads_used: stats.uploads_used + 1,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_upload_date: today,
      bonus_uploads: stats.bonus_uploads + bonusIncrease,
    }).eq("user_id", user.id);

    // Check for new badges
    if (isNewDay) {
      for (const badge of BADGE_DEFINITIONS) {
        if (newStreak >= badge.threshold) {
          const existing = badges.find(b => b.badge_type === badge.type);
          if (!existing) {
            await supabase.from("user_badges").insert({
              user_id: user.id,
              badge_type: badge.type,
              badge_name: badge.name,
            });
          }
        }
      }
    }

    await fetchStats();
    return { bonusEarned: bonusIncrease > 0, newStreak, isNewDay };
  };

  const getReferralLink = () => {
    if (!stats) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/auth?ref=${stats.referral_code}`;
  };

  const processReferral = async (referralCode: string) => {
    if (!user) return { success: false, message: "Not logged in" };

    // Check if already referred
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", user.id)
      .single();
    if (existing) return { success: false, message: "Already used a referral" };

    // Find referrer
    const { data: referrer } = await supabase
      .from("user_stats")
      .select("user_id, referrals_this_month")
      .eq("referral_code", referralCode)
      .single();
    if (!referrer) return { success: false, message: "Invalid referral code" };
    if (referrer.user_id === user.id) return { success: false, message: "Cannot refer yourself" };

    // Check referrer's monthly limit
    if (referrer.referrals_this_month >= MAX_REFERRALS_PER_MONTH) {
      return { success: false, message: "Referrer has reached monthly limit" };
    }

    // Create referral
    await supabase.from("referrals").insert({
      referrer_user_id: referrer.user_id,
      referred_user_id: user.id,
    });

    // Reward referrer: +1 bonus upload and +1 streak freeze
    await supabase.from("user_stats").update({
      bonus_uploads: (await supabase.from("user_stats").select("bonus_uploads").eq("user_id", referrer.user_id).single()).data!.bonus_uploads + 1,
      streak_freezes: (await supabase.from("user_stats").select("streak_freezes").eq("user_id", referrer.user_id).single()).data!.streak_freezes + 1,
      referrals_this_month: referrer.referrals_this_month + 1,
    }).eq("user_id", referrer.user_id);

    // Reward referred user: +1 bonus upload
    await supabase.from("user_stats").update({
      bonus_uploads: (stats?.bonus_uploads || 0) + 1,
    }).eq("user_id", user.id);

    await fetchStats();
    return { success: true, message: "Referral applied! You earned 1 bonus upload." };
  };

  const renewStreakWithReferral = async () => {
    // Streak is broken, user must refer 1 person to renew
    // This is handled by the referral flow giving streak freezes
    return stats?.current_streak === 0;
  };

  return {
    stats,
    badges,
    referrals,
    loading,
    canUpload,
    uploadsRemaining,
    totalUploadsAllowed,
    referralsRemaining,
    canRefer,
    daysUntilReferralReset,
    recordUpload,
    getReferralLink,
    processReferral,
    fetchStats,
    FREE_UPLOAD_LIMIT,
    MAX_REFERRALS_PER_MONTH,
    FREE_PODCAST_MAX_EXCHANGES,
    FREE_QUIZ_MAX_QUESTIONS,
    STREAK_BONUS_INTERVAL,
    BADGE_DEFINITIONS,
  };
}
