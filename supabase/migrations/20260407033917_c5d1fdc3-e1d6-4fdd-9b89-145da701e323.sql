
CREATE TABLE public.study_music_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  genre text NOT NULL,
  would_use_daily text NOT NULL,
  email text NOT NULL,
  user_id uuid
);

ALTER TABLE public.study_music_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.study_music_waitlist FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Authenticated users can insert" ON public.study_music_waitlist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view own" ON public.study_music_waitlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
