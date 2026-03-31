ALTER TABLE public.profiles
  ADD COLUMN subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_expires_at timestamptz;