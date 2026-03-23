CREATE INDEX IF NOT EXISTS idx_user_stats_referral_code ON public.user_stats(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_stats_last_upload_date ON public.user_stats(last_upload_date);
CREATE INDEX IF NOT EXISTS idx_user_stats_current_streak_desc ON public.user_stats(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON public.referrals(referrer_user_id);