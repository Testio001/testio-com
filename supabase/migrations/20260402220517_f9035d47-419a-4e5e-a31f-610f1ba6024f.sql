CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role full access push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);