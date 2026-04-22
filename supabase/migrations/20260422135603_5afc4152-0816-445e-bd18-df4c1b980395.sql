-- Track device fingerprints to detect duplicate free accounts
CREATE TABLE public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_fingerprints_fp ON public.device_fingerprints(fingerprint);
CREATE INDEX idx_device_fingerprints_user ON public.device_fingerprints(user_id);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages fingerprints"
ON public.device_fingerprints FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view own fingerprints"
ON public.device_fingerprints FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add abuse flags to user_stats
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS is_abuse_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abuse_reason text;

-- Add fingerprint tracking to account_history so we remember devices of deleted accounts
ALTER TABLE public.account_history
  ADD COLUMN IF NOT EXISTS device_fingerprint text;

CREATE INDEX IF NOT EXISTS idx_account_history_fp ON public.account_history(device_fingerprint);

-- Edge function callable RPC: check if a device has already had a free account
CREATE OR REPLACE FUNCTION public.check_device_abuse(_fingerprint text, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count int;
  v_history_count int;
  v_email_lower text := lower(_email);
  v_email_previously_deleted boolean;
BEGIN
  -- Count current accounts on this device
  SELECT count(DISTINCT user_id) INTO v_existing_count
  FROM public.device_fingerprints
  WHERE fingerprint = _fingerprint;

  -- Count deleted accounts on this device
  SELECT count(*) INTO v_history_count
  FROM public.account_history
  WHERE device_fingerprint = _fingerprint;

  -- Check if email was previously deleted
  SELECT EXISTS(
    SELECT 1 FROM public.account_history WHERE email_lower = v_email_lower
  ) INTO v_email_previously_deleted;

  RETURN jsonb_build_object(
    'device_account_count', v_existing_count,
    'device_history_count', v_history_count,
    'email_previously_deleted', v_email_previously_deleted,
    'is_abuse', (v_existing_count > 0 OR v_history_count > 0 OR v_email_previously_deleted)
  );
END;
$$;