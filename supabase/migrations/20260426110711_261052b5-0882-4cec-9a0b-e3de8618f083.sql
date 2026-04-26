ALTER TABLE public.user_stats
ADD COLUMN IF NOT EXISTS streak_bonus_uploads integer NOT NULL DEFAULT 0;