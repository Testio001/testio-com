import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Loader2, Crown, Calendar, ExternalLink, Music, Sparkles, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import testioLogo from "@/assets/testio-logo.png";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import StudyMusicModal from "@/components/app/StudyMusicModal";
import { Badge } from "@/components/ui/badge";
import CancelRetentionModal from "@/components/app/CancelRetentionModal";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { formatTrialDate } from "@/lib/trial";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [subscriptionExpires, setSubscriptionExpires] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showStudyMusic, setShowStudyMusic] = useState(false);
  const [subInfo, setSubInfo] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const { trialEndsAt, onTrial, refresh: refreshTrial } = useTrialStatus();
  /** Billing status wins: a converted paid user keeps a past trial_ends_at value. */
  const isTrial = subInfo?.status ? subInfo.status === "on_trial" : onTrial;

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  useEffect(() => {
    if (user && subscriptionPlan !== "free") loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, subscriptionPlan]);

  const loadSubscription = async () => {
    setSubLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", { body: { action: "status" } });
      if (!error) setSubInfo(data);
    } finally {
      setSubLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", { body: { action: "cancel" } });
      const payload: any = data;
      if (error || payload?.error) throw new Error(payload?.error || error?.message || "Failed to cancel");
      toast({
        title: "Subscription cancelled",
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

  const fetchProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
    if (data) {
      setDisplayName(data.display_name || "");
      setEmail(data.email || user!.email || "");
      setSubscriptionPlan(data.subscription_plan || "free");
      setSubscriptionExpires(data.subscription_expires_at || null);
    } else {
      setEmail(user!.email || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user!.id);
      if (error) throw error;
      toast({ title: "Profile updated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Profile</h1>
          </div>
          <img src={testioLogo} alt="Testio" className="w-8 h-8" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-testio-card rounded-xl p-6 space-y-4">
          <div>
            <label className="text-muted-foreground text-xs block mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-muted-foreground text-xs block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-muted-foreground text-sm cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {/* Subscription Status */}
        <div className="bg-testio-card rounded-xl p-6 space-y-4">
          <h2 className="text-foreground font-semibold text-sm flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            Subscription
          </h2>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              subscriptionPlan === "pro"
                ? "bg-primary/20 text-primary"
                : subscriptionPlan === "basic"
                ? "bg-accent/20 text-accent-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {subscriptionPlan === "pro" ? "Pro" : subscriptionPlan === "basic" ? "Basic" : "Free"}
            </span>
          </div>
          {subscriptionExpires && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {new Date(subscriptionExpires) > new Date()
                  ? `Renews ${new Date(subscriptionExpires).toLocaleDateString()}`
                  : `Expired ${new Date(subscriptionExpires).toLocaleDateString()}`}
              </span>
            </div>
          )}
          {onTrial && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <p className="text-foreground text-xs font-semibold">
                Your free trial ends {formatTrialDate(trialEndsAt)} — cancel anytime before then to avoid being charged.
              </p>
            </div>
          )}
          {subscriptionPlan === "free" ? (
            <button
              onClick={() => navigate("/pricing")}
              className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
            >
              <Crown className="w-4 h-4" /> Upgrade Plan
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate("/pricing")}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
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
                    plan={subscriptionPlan}
                    endsAt={subInfo?.endsAt ?? subscriptionExpires}
                    cancelling={cancelling}
                    onConfirm={handleCancelSubscription}
                    onStay={() => toast({ title: "Great choice — your plan is still active", description: "Nothing changed. Keep the streak going!" })}
                  />
                </div>
              ) : subInfo?.cancelled ? (
                <p className="text-xs text-muted-foreground">
                  Subscription cancelled{subInfo.endsAt ? ` — access ends ${new Date(subInfo.endsAt).toLocaleDateString()}` : ""}. You won't be billed again.
                </p>
              ) : subInfo ? (
                <p className="text-xs text-muted-foreground">
                  No recurring subscription found for your email — your access is a one-off purchase and will simply expire, so there's nothing to cancel.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <PushNotificationSettings />

        {/* Study Music — moved here from dashboard for clarity */}
        <button
          onClick={() => setShowStudyMusic(true)}
          className="w-full text-left bg-testio-card rounded-xl p-5 hover:border-primary/30 transition-all border border-border relative overflow-hidden"
        >
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Coming Soon</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 pr-16">
              <h3 className="text-foreground font-semibold text-sm flex items-center gap-1.5">
                Study Music <Sparkles className="w-3.5 h-3.5 text-primary" />
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">Turn your notes into catchy songs for memorization. Join the waitlist.</p>
            </div>
          </div>
        </button>
        <StudyMusicModal open={showStudyMusic} onOpenChange={setShowStudyMusic} />
      </div>
    </div>
  );
};

export default Profile;
