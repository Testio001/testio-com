CREATE TABLE public.korapay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference text NOT NULL UNIQUE,
  plan text NOT NULL,
  amount_ngn integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_korapay_tx_user ON public.korapay_transactions(user_id);
CREATE INDEX idx_korapay_tx_reference ON public.korapay_transactions(reference);

ALTER TABLE public.korapay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own korapay transactions"
ON public.korapay_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts korapay transactions"
ON public.korapay_transactions FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role updates korapay transactions"
ON public.korapay_transactions FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_korapay_transactions_updated_at
BEFORE UPDATE ON public.korapay_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();