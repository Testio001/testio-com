-- Instant purge with space reclaim (TRUNCATE doesn't need VACUUM)
TRUNCATE TABLE cron.job_run_details;

-- Remove existing cleanup job if any
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-logs') THEN
    PERFORM cron.unschedule('cleanup-cron-logs');
  END IF;
END $$;

-- Daily auto-cleanup
SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; $$
);