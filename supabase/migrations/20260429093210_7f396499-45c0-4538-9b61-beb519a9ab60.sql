-- Remove the Top 10 daily +2 bonus uploads policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grant-top10-daily-bonus') THEN
      PERFORM cron.unschedule('grant-top10-daily-bonus');
    END IF;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.grant_top10_daily_bonus();