ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS last_streak_freeze_at timestamp with time zone;