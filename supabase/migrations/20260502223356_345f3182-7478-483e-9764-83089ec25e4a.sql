
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rewarded_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_status
  ON public.referrals(referred_user_id, status);
