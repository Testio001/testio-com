import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Lock, Crown, Check, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TRIAL_DAYS, TRIAL_PRICE_USD, formatTrialDate, projectedTrialEnd, startProTrialCheckout } from "@/lib/trial";
import { NGN_PRICES, formatNgn } from "@/hooks/useCurrency";

interface Props {
  open: boolean;
  onClose: () => void;
  /** "trial" = USD free-trial offer, "ngn" = Naira one-off offer (no trial) */
  mode: "trial" | "ngn";
}

/**
 * Full-screen opt-in paywall shown right after signup (and reusable from any
 * upgrade CTA). Free-trial first for USD; Naira users get the equivalent
 * one-off unlock instead, since Korapay has no trial/auto-renew.
 */
const ProTrialPaywall = ({ open, onClose, mode }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const isTrial = mode === "trial";
  const billingDate = formatTrialDate(projectedTrialEnd());
  const expiryDate = formatTrialDate(projectedTrialEnd(30));

  const start = async () => {
    setLoading(true);
    try {
      if (isTrial) {
        await startProTrialCheckout();
        return;
      }
      const { data, error } = await supabase.functions.invoke("korapay-initialize", {
        body: { plan: "starter", frontendOrigin: window.location.origin },
      });
      if (error) throw error;
      if (data?.checkout_url) { window.location.href = data.checkout_url; return; }
      throw new Error("Could not open checkout. Please try again.");
    } catch (err: any) {
      toast({ title: "Couldn't open checkout", description: err.message || "Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const steps = isTrial
    ? [
        { icon: Lock, title: `Start your ${TRIAL_DAYS}-day free trial`, body: "Full Pro access unlocks instantly — uploads, long podcasts, unlimited quizzes and AI Tutor." },
        { icon: Crown, title: `Your subscription starts ${billingDate}`, body: `${TRIAL_PRICE_USD} per month after the trial. Cancel anytime before then and you pay nothing.` },
      ]
    : [
        { icon: Lock, title: "Unlock Starter instantly", body: "10 uploads a month, unlimited AI summaries, flashcards and quizzes — paid in Naira." },
        { icon: Crown, title: `Valid until ${expiryDate}`, body: "One-off payment with no auto-renewal. Cancel anytime — you're never billed automatically." },
      ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-paywall-title"
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-end px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="max-w-md mx-auto">
          {/* Hero */}
          <div className="rounded-3xl bg-gradient-to-b from-primary/25 via-primary/10 to-transparent h-40 flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30">
              <Crown className="w-10 h-10" />
            </div>
          </div>

          <p className="text-primary font-semibold text-sm text-center">{isTrial ? "Testio Pro" : "Testio Starter"}</p>
          <h2 id="trial-paywall-title" className="text-3xl font-extrabold text-foreground text-center mt-1">
            Get Unlimited Access
          </h2>
          <p className="text-muted-foreground text-sm text-center mt-2 mb-8">
            {isTrial
              ? `Study smarter anywhere — free for ${TRIAL_DAYS} days.`
              : "Study smarter anywhere — pay once in Naira, no auto-renewal."}
          </p>

          {/* Timeline */}
          <div className="relative pl-2 mb-7">
            {steps.map((s, i) => (
              <div key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <div className="pt-1">
                  <p className="text-foreground font-semibold text-sm">{s.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status pill */}
          <div className="rounded-2xl bg-secondary border border-border px-4 py-3 mb-4 flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-foreground text-sm font-semibold">
              {isTrial ? "Free Trial Enabled" : "Instant Access Enabled"}
            </span>
          </div>

          {/* Due rows */}
          <div className="rounded-2xl border border-border divide-y divide-border mb-4">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-foreground font-medium">Due today</span>
              <span className="flex items-center gap-3">
                {isTrial && <span className="text-primary text-xs font-semibold">{TRIAL_DAYS} days free</span>}
                <span className="text-foreground font-semibold">{isTrial ? "$0.00" : formatNgn(NGN_PRICES.starter)}</span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">{isTrial ? `Due ${billingDate}` : `Expires ${expiryDate}`}</span>
              <span className="text-muted-foreground font-medium">{isTrial ? TRIAL_PRICE_USD : "No auto-charge"}</span>
            </div>
          </div>

          <p className="text-muted-foreground text-xs flex items-center justify-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Secure checkout · Cancel anytime
          </p>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="px-5 pt-3 pb-5 border-t border-border bg-background">
        <div className="max-w-md mx-auto">
          <button
            onClick={start}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isTrial ? "Try Free" : "Unlock Starter"}
          </button>
          <button
            onClick={() => { onClose(); navigate("/pricing"); }}
            className="w-full mt-3 py-3 rounded-2xl border border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
          >
            See all pricing options
          </button>
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            Cancel anytime{isTrial ? " before the trial ends and you won't be charged." : " — one-off payment, never auto-renewed."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProTrialPaywall;
