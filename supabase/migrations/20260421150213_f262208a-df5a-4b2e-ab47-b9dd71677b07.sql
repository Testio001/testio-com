-- ============================================================
-- 1. AI USAGE LOG TABLE (for rate limiting)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_func_time
  ON public.ai_usage_log (user_id, function_name, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (for showing limits in UI later)
CREATE POLICY "Users view own ai usage"
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role inserts (edge functions use service role)
CREATE POLICY "Service role inserts ai usage"
  ON public.ai_usage_log FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. RATE-LIMIT CHECK FUNCTION
-- Balanced tier, per-function buckets
-- Free: 10/hr, 40/day | Pro/Basic: 60/hr, 300/day | Scholar/Elite: 200/hr, 1000/day
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id uuid,
  _function_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_expires timestamptz;
  v_active_plan text;
  v_hour_limit int;
  v_day_limit int;
  v_hour_used int;
  v_day_used int;
BEGIN
  -- Resolve effective plan
  SELECT subscription_plan, subscription_expires_at
    INTO v_plan, v_expires
  FROM public.profiles WHERE user_id = _user_id;

  IF v_plan IS NULL THEN v_plan := 'free'; END IF;

  IF v_plan IN ('basic','pro','scholar','elite')
     AND v_expires IS NOT NULL
     AND v_expires > now() THEN
    v_active_plan := v_plan;
  ELSE
    v_active_plan := 'free';
  END IF;

  -- Set limits by plan
  IF v_active_plan = 'free' THEN
    v_hour_limit := 10; v_day_limit := 40;
  ELSIF v_active_plan IN ('basic','pro') THEN
    v_hour_limit := 60; v_day_limit := 300;
  ELSE -- scholar / elite
    v_hour_limit := 200; v_day_limit := 1000;
  END IF;

  -- Count current usage
  SELECT count(*) INTO v_hour_used
  FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 hour';

  SELECT count(*) INTO v_day_used
  FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 day';

  IF v_hour_used >= v_hour_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'limit', v_hour_limit,
      'used', v_hour_used,
      'plan', v_active_plan,
      'retry_after_minutes', 60
    );
  END IF;

  IF v_day_used >= v_day_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'limit', v_day_limit,
      'used', v_day_used,
      'plan', v_active_plan,
      'retry_after_minutes', 60 * 24
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_active_plan,
    'hour_used', v_hour_used,
    'hour_limit', v_hour_limit,
    'day_used', v_day_used,
    'day_limit', v_day_limit
  );
END;
$$;

-- ============================================================
-- 3. PROFILE PRIVACY: hide emails from other users
-- Drop the overly permissive read policy and replace with owner-only.
-- Create a public_profiles VIEW that exposes only display_name for leaderboard.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Public-safe view: ONLY display_name + user_id, no email, no plan, no dates
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
  SELECT user_id, display_name
  FROM public.profiles;

-- The view inherits RLS via security_invoker, but we want it readable by all
-- authenticated users for the leaderboard. We add a permissive SELECT policy
-- that ONLY applies when reading via the view (the view already excludes
-- sensitive columns, and the underlying table policy still blocks direct reads).
-- To allow this, we add a second profiles SELECT policy scoped to the columns
-- the view uses. Simplest: create a SECURITY DEFINER function for leaderboard names.

CREATE OR REPLACE FUNCTION public.get_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO authenticated;

-- ============================================================
-- 4. PODCASTS BUCKET → PRIVATE
-- Switch to private; access via signed URLs from the edge function.
-- Add owner-scoped policies on storage.objects so users can read/list
-- only their own podcast files (folder = user_id).
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'podcasts';

-- Clean up any pre-existing podcast policies to avoid duplicates
DROP POLICY IF EXISTS "Users can read own podcasts" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages podcasts" ON storage.objects;

CREATE POLICY "Users can read own podcasts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'podcasts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role manages podcasts"
  ON storage.objects FOR ALL
  TO public
  USING (bucket_id = 'podcasts' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'podcasts' AND auth.role() = 'service_role');