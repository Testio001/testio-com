import { useEffect, useState } from "react";
import ProTrialPaywall from "@/components/app/ProTrialPaywall";
import { useCurrency } from "@/hooks/useCurrency";

const STORAGE_KEY = "signup_offer_paywall_seen_v1";

/**
 * Shown once, right after signup, in place of the old 50%-off modal.
 * USD users get the Pro free-trial opt-in; Naira users get the Starter offer.
 */
const SignupOfferPaywall = ({ userPlan, trialEndsAt }: { userPlan: string | null; trialEndsAt?: string | null }) => {
  const { currency, isCurrencyLoading } = useCurrency();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isCurrencyLoading) return;
    if (userPlan && userPlan !== "free") return;
    if (trialEndsAt) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [userPlan, trialEndsAt, isCurrencyLoading]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return <ProTrialPaywall open={open} onClose={close} mode={currency === "NGN" ? "ngn" : "trial"} />;
};

export default SignupOfferPaywall;
