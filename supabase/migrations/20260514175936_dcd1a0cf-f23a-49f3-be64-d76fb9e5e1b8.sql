
CREATE TABLE IF NOT EXISTS public.user_visits (
  user_id uuid PRIMARY KEY,
  visit_count integer NOT NULL DEFAULT 0,
  last_visit_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own visits" ON public.user_visits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages visits" ON public.user_visits
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.increment_user_visit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.user_visits (user_id, visit_count, last_visit_at)
  VALUES (v_uid, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET visit_count = public.user_visits.visit_count + 1,
        last_visit_at = now()
  RETURNING visit_count INTO v_count;

  RETURN v_count;
END;
$$;
