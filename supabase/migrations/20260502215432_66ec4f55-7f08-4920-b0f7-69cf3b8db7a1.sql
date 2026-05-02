DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Authenticated can listen own user_stats topic') THEN
    EXECUTE 'DROP POLICY "Authenticated can listen own user_stats topic" ON realtime.messages';
  END IF;
END $$;