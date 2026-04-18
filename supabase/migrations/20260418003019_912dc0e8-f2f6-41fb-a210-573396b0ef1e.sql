-- 1. account_history table for re-signup abuse prevention
CREATE TABLE IF NOT EXISTS public.account_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_hash TEXT NOT NULL,
  email_lower TEXT NOT NULL,
  last_plan TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_history_email_hash ON public.account_history(email_hash);
CREATE INDEX IF NOT EXISTS idx_account_history_email_lower ON public.account_history(email_lower);

ALTER TABLE public.account_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read account history"
  ON public.account_history FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert account history"
  ON public.account_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 2. previously_deleted flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS previously_deleted BOOLEAN NOT NULL DEFAULT false;

-- 3. is_seeded_user flag on user_stats
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS is_seeded_user BOOLEAN NOT NULL DEFAULT false;

-- 4. Public podcasts bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('podcasts', 'podcasts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public can read podcasts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'podcasts');

CREATE POLICY "Service role can upload podcasts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'podcasts' AND auth.role() = 'service_role');

CREATE POLICY "Service role can update podcasts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'podcasts' AND auth.role() = 'service_role');

CREATE POLICY "Service role can delete podcasts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'podcasts' AND auth.role() = 'service_role');

-- 5. Updated handle_new_user to flag re-signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previously_deleted BOOLEAN := false;
BEGIN
  -- Check if this email was previously deleted
  SELECT EXISTS (
    SELECT 1 FROM public.account_history
    WHERE email_lower = lower(NEW.email)
  ) INTO v_previously_deleted;

  INSERT INTO public.profiles (user_id, email, display_name, previously_deleted)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_previously_deleted
  );
  RETURN NEW;
END;
$function$;

-- 6. Seed streaks for the first 22 users by signup date
WITH first_22 AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 22
)
UPDATE public.user_stats us
SET
  current_streak = CASE
    WHEN p.email ILIKE 'testimony.bankole%' THEN 321
    ELSE 88 + ((f.rn * 7) % 113)  -- deterministic 88-200 spread
  END,
  longest_streak = GREATEST(
    us.longest_streak,
    CASE
      WHEN p.email ILIKE 'testimony.bankole%' THEN 321
      ELSE 88 + ((f.rn * 7) % 113)
    END
  ),
  is_seeded_user = true,
  updated_at = now()
FROM first_22 f
JOIN public.profiles p ON p.user_id = f.user_id
WHERE us.user_id = f.user_id;

-- 7. Daily increment function for seeded users
CREATE OR REPLACE FUNCTION public.bump_seeded_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_stats
  SET
    current_streak = current_streak + 1,
    longest_streak = GREATEST(longest_streak, current_streak + 1),
    updated_at = now()
  WHERE is_seeded_user = true;
END;
$function$;