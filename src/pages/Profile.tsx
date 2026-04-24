import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Loader2, Crown, Calendar, ExternalLink, Music, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import testioLogo from "@/assets/testio-logo.png";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import StudyMusicModal from "@/components/app/StudyMusicModal";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

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
          {subscriptionPlan === "free" ? (
            <button
              onClick={() => navigate("/pricing")}
              className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
            >
              <Crown className="w-4 h-4" /> Upgrade Plan
            </button>
          ) : (
            <button
              onClick={() => navigate("/pricing")}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Manage Subscription
            </button>
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
