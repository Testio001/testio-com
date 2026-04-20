-- Function to grant +2 daily bonus uploads to the current Top 10 leaderboard users
CREATE OR REPLACE FUNCTION public.grant_top10_daily_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH top10 AS (
    SELECT user_id
    FROM public.user_stats
    ORDER BY current_streak DESC, longest_streak DESC
    LIMIT 10
  )
  UPDATE public.user_stats us
  SET bonus_uploads = us.bonus_uploads + 2,
      updated_at = now()
  FROM top10
  WHERE us.user_id = top10.user_id;
END;
$$;

-- Schedule it daily at 00:05 UTC via pg_cron (extension already enabled in Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('grant-top10-daily-bonus') 
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grant-top10-daily-bonus');
    PERFORM cron.schedule(
      'grant-top10-daily-bonus',
      '5 0 * * *',
      $cron$SELECT public.grant_top10_daily_bonus();$cron$
    );
  END IF;
END $$;