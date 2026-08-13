import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TrialStatus {
  loading: boolean;
  plan: string;
  /** trial_ends_at from profiles (set by the LemonSqueezy webhook on on_trial) */
  trialEndsAt: string | null;
  /** true while the trial end date is still in the future */
  onTrial: boolean;
  /** user has never had a trial before */
  neverTrialed: boolean;
  refresh: () => Promise<void>;
}

export function useTrialStatus(): TrialStatus {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    const row = data as any;
    setPlan(row?.subscription_plan || "free");
    setTrialEndsAt(row?.trial_ends_at ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onTrial = !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();

  return { loading, plan, trialEndsAt, onTrial, neverTrialed: !trialEndsAt, refresh };
}
