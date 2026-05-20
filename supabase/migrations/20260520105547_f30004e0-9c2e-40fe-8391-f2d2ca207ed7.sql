DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grant-top10-daily-bonus') THEN
      PERFORM cron.unschedule('grant-top10-daily-bonus');
    END IF;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.grant_top10_daily_bonus();

UPDATE public.user_stats
SET bonus_uploads = 0,
    streak_bonus_uploads = 0,
    updated_at = now()
WHERE bonus_uploads > 0 OR streak_bonus_uploads > 0;