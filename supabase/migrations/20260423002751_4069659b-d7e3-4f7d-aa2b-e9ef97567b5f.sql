-- Create role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles table (roles MUST be stored separately)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role manages roles" ON public.user_roles;
CREATE POLICY "Service role manages roles"
ON public.user_roles
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admin-only streak setter
CREATE OR REPLACE FUNCTION public.admin_set_user_streak(_target_user_id uuid, _new_streak integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _new_streak < 0 OR _new_streak > 100000 THEN
    RAISE EXCEPTION 'invalid_streak';
  END IF;

  SELECT current_streak INTO v_old FROM public.user_stats WHERE user_id = _target_user_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'user_stats_not_found';
  END IF;

  UPDATE public.user_stats
  SET current_streak = _new_streak,
      longest_streak = GREATEST(longest_streak, _new_streak),
      updated_at = now()
  WHERE user_id = _target_user_id;

  RETURN jsonb_build_object('user_id', _target_user_id, 'old_streak', v_old, 'new_streak', _new_streak);
END;
$$;

-- Admin lookup helper (email -> user info) for the admin page
CREATE OR REPLACE FUNCTION public.admin_lookup_user_by_email(_email text)
RETURNS TABLE(user_id uuid, email text, display_name text, current_streak int, longest_streak int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.email, p.display_name,
         COALESCE(us.current_streak, 0),
         COALESCE(us.longest_streak, 0)
  FROM public.profiles p
  LEFT JOIN public.user_stats us ON us.user_id = p.user_id
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
END;
$$;

-- Grant admin to the specified email if present
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(p.email) = lower('Testimony.bankole@elizadeuniversity.edu.ng')
ON CONFLICT (user_id, role) DO NOTHING;