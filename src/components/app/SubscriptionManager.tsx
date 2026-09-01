import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { formatTrialDate } from "@/lib/trial";
import { Crown, ExternalLink, Loader2, XCircle } from "lucide-react";
import CancelRetentionModal from "@/components/app/CancelRetentionModal";

/** Self-contained subscription / trial management card (used on Settings). */
const SubscriptionManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trialEndsAt, onTrial, refresh: refreshTrial } = useTrialStatus();
  const [plan, setPlan] = useState("free");
  const [subInfo, setSubInfo] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelFlow, setShowCancelFlow] = useState(false);

  const loadSubscription = useCallback(async () => {
    setSubLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", { body: { action: "status" } });
      if (!error) setSubInfo(data);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setPlan((data as any)?.subscription_plan || "free"));
  }, [user]);

  useEffect(() => {
    if (user && plan !== "free") loadSubscription();
  }, [user, plan, loadSubscription]);

  const isTrial = subInfo?.status ? subInfo.status === "on_trial" : onTrial;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", { body: { action: "cancel" } });
      const payload: any = data;
      if (error || payload?.error) throw new Error(payload?.error || error?.message || "Failed to cancel");
      toast({
        title: isTrial ? "Free trial cancelled" : "Subscription cancelled",
        description: payload?.endsAt
          ? `You keep access until ${new Date(payload.endsAt).toLocaleDateString()}. You won't be billed again.`
          : "You won't be billed again.",
      });
      await loadSubscription();
      await refreshTrial();
      setShowCancelFlow(false);
    } catch (err: any) {
      toast({ title: "Couldn't cancel", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-testio-card rounded-xl p-6">
      <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
        <Crown className="w-4 h-4" /> Subscription
      </h3>

      <p className="text-sm text-muted-foreground mb-4">
        Current plan: <span className="text-foreground font-medium capitalize">{plan}</span>
        {isTrial && trialEndsAt ? ` — free trial ends ${formatTrialDate(trialEndsAt)}` : ""}
      </p>

      {plan === "free" ? (
        <button onClick={() => navigate("/pricing")} className="btn-testio-primary text-sm !py-2 !px-6">
          Upgrade Plan
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => navigate("/pricing")} className="text-sm text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Change Plan
            </button>
            {subInfo?.portalUrl && (
              <a
                href={subInfo.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Billing Portal
              </a>
            )}
          </div>

          {subLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your billing status…
            </p>
          ) : subInfo?.hasSubscription && !subInfo?.cancelled ? (
            <div className="pt-1">
              <button
                onClick={() => setShowCancelFlow(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-destructive/60 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="w-4 h-4" />
                {isTrial ? "Cancel Free Trial" : "Cancel Subscription"}
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {isTrial
                  ? "Cancelling now ends your trial's auto-renewal — you keep access until the trial end date and are never charged."
                  : "You keep full access until the end of your current billing period. No further charges."}
              </p>
              <CancelRetentionModal
                open={showCancelFlow}
                onOpenChange={setShowCancelFlow}
                plan={plan}
                endsAt={subInfo?.endsAt ?? trialEndsAt}
                cancelling={cancelling}
                onConfirm={handleCancel}
                onStay={() => toast({ title: "Great choice — your plan is still active", description: "Nothing changed. Keep the streak going!" })}
              />
            </div>
          ) : subInfo?.cancelled ? (
            <p className="text-xs text-muted-foreground">
              {isTrial ? "Free trial cancelled" : "Subscription cancelled"}
              {subInfo.endsAt ? ` — access ends ${new Date(subInfo.endsAt).toLocaleDateString()}` : ""}. You won't be billed again.
            </p>
          ) : subInfo ? (
            <p className="text-xs text-muted-foreground">
              No recurring subscription found for your email — your access is a one-off purchase and will simply expire, so there's nothing to cancel.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
