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

export interface GamificationData {
  stats: UserStats | null;
  badges: Badge[];
  referrals: Referral[];
  loading: boolean;
  canUpload: boolean;
  uploadsRemaining: number;
  totalUploadsAllowed: number;
  referralsRemaining: number;
  canRefer: boolean;
  daysUntilReferralReset: number;
  isAbuseFlagged: boolean;
  abuseReason: string | null;
  recordUpload: () => Promise<{ bonusEarned: boolean; newStreak: number; isNewDay: boolean } | undefined>;
  getReferralLink: () => string;
  processReferral: (code: string) => Promise<{ success: boolean; message: string }>;
  fetchStats: () => Promise<void>;
  optimisticIncrement: () => void;
  FREE_UPLOAD_LIMIT: number;
  MAX_REFERRALS_PER_MONTH: number;
  FREE_PODCAST_MAX_EXCHANGES: number;
  BASIC_PODCAST_MAX_EXCHANGES: number;
  PRO_PODCAST_MAX_EXCHANGES: number;
  SCHOLAR_PODCAST_MAX_EXCHANGES: number;
  FREE_QUIZ_MAX_QUESTIONS: number;
  STREAK_BONUS_INTERVAL: number;
  BADGE_DEFINITIONS: typeof BADGE_DEFINITIONS;
}

const FREE_UPLOAD_LIMIT = 2;
const MAX_REFERRALS_PER_MONTH = 5;
// Podcast exchange counts (each exchange ≈ 30s of audio)
const FREE_PODCAST_MAX_EXCHANGES = 8;   // ~4 min
const BASIC_PODCAST_MAX_EXCHANGES = 14; // ~7 min
const PRO_PODCAST_MAX_EXCHANGES = 24;   // ~12 min
const SCHOLAR_PODCAST_MAX_EXCHANGES = 30; // ~15 min
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

async function invokeGamification(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("manage-gamification", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function useGamification(): GamificationData {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadsRemaining, setUploadsRemaining] = useState(0);
  const [totalUploadsAllowed, setTotalUploadsAllowed] = useState(FREE_UPLOAD_LIMIT);
  // Default to FALSE — only allow uploads after the server confirms remaining quota.
  // Otherwise a stale/loading state lets users sneak in an extra upload.
  const [canUpload, setCanUpload] = useState(false);
  const [referralsRemaining, setReferralsRemaining] = useState(MAX_REFERRALS_PER_MONTH);
  const [canRefer, setCanRefer] = useState(true);
  const [isAbuseFlagged, setIsAbuseFlagged] = useState(false);
  const [abuseReason, setAbuseReason] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const data = await invokeGamification("get-stats");
      setStats(data.stats as UserStats);
      setBadges((data.badges || []) as Badge[]);
      setReferrals((data.referrals || []) as Referral[]);
      setTotalUploadsAllowed(data.totalUploadsAllowed);
      setUploadsRemaining(data.uploadsRemaining);
      setCanUpload(data.canUpload);
      setReferralsRemaining(data.referralsRemaining);
      setCanRefer(data.canRefer);
      setIsAbuseFlagged(!!data.isAbuseFlagged);
      setAbuseReason(data.abuseReason ?? null);
    } catch {
      // Silent fail on stats fetch
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Optimistic UI: immediately show streak increment before backend confirms
  const optimisticIncrement = useCallback(() => {
    setStats((prev) => {
      if (!prev) return prev;
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = prev.last_upload_date !== today;
      return {
        ...prev,
        uploads_used: prev.uploads_used + 1,
        current_streak: isNewDay ? prev.current_streak + 1 : prev.current_streak,
        last_upload_date: today,
      };
    });
    setUploadsRemaining((prev) => Math.max(0, prev - 1));
  }, []);

  const recordUpload = async () => {
    if (!user || !stats) return;
    try {
      const result = await invokeGamification("record-upload");
      // Refresh stats from server after recording
      await fetchStats();
      return result;
    } catch {
      // Rollback optimistic update on failure
      await fetchStats();
      return undefined;
    }
  };

  const getReferralLink = () => {
    if (!stats) return "";
    return `${window.location.origin}/auth?ref=${stats.referral_code}`;
  };

  const processReferral = async (referralCode: string) => {
    if (!user) return { success: false, message: "Not logged in" };
    try {
      const result = await invokeGamification("process-referral", { referralCode });
      if (result.success) await fetchStats();
      return result;
    } catch {
      return { success: false, message: "Connection issue. Check your internet and try again." };
    }
  };

  const daysUntilReferralReset = (() => {
    if (!stats) return 0;
    const resetDate = new Date(stats.referrals_month_reset);
    resetDate.setMonth(resetDate.getMonth() + 1);
    const diff = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

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
    isAbuseFlagged,
    abuseReason,
    recordUpload,
    getReferralLink,
    processReferral,
    fetchStats,
    optimisticIncrement,
    FREE_UPLOAD_LIMIT,
    MAX_REFERRALS_PER_MONTH,
    FREE_PODCAST_MAX_EXCHANGES,
    BASIC_PODCAST_MAX_EXCHANGES,
    PRO_PODCAST_MAX_EXCHANGES,
    SCHOLAR_PODCAST_MAX_EXCHANGES,
    FREE_QUIZ_MAX_QUESTIONS,
    STREAK_BONUS_INTERVAL,
    BADGE_DEFINITIONS,
  };
}
