SELECT cron.schedule(
  'bump-seeded-streaks-daily',
  '5 0 * * *',
  $$SELECT public.bump_seeded_streaks();$$
);