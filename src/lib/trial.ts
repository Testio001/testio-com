import { supabase } from "@/integrations/supabase/client";

/** Length of the LemonSqueezy native free trial on the Pro variant. */
export const TRIAL_DAYS = 3;
export const TRIAL_PLAN = "pro";
export const TRIAL_PRICE_USD = "$9.99";

export const formatTrialDate = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
};

export const projectedTrialEnd = (days = TRIAL_DAYS): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/**
 * Opens the LemonSqueezy Pro checkout. Because the Pro variant has a native
 * free trial configured in LemonSqueezy, this is also the "start free trial"
 * entry point — the buyer is charged nothing today.
 */
export const startProTrialCheckout = async (): Promise<void> => {
  const { data, error } = await supabase.functions.invoke("initialize-payment", {
    body: { plan: TRIAL_PLAN, trial: true, frontendOrigin: window.location.origin },
  });
  if (error) throw error;
  if (!data?.checkout_url) throw new Error("Could not open checkout. Please try again.");
  window.location.href = data.checkout_url;
};
