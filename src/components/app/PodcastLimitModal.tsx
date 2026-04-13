import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Zap, Crown, Loader2, X, Sparkles } from "lucide-react";

interface PodcastLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionPlan: string;
}

const PodcastLimitModal = ({ isOpen, onClose, subscriptionPlan }: PodcastLimitModalProps) => {
  const navigate = useNavigate();
  const [loadingAddon, setLoadingAddon] = useState(false);
  const isPro = subscriptionPlan === "pro";

  const handleBuyAddon = async () => {
    setLoadingAddon(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { plan: "podcast_addon" },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setLoadingAddon(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Podcast Limit Reached</h2>
          <p className="text-muted-foreground text-sm">
            You've used all your podcast credits. Get more to keep learning on the go!
          </p>
        </div>

        <div className="space-y-3">
          {/* Always show the addon option */}
          <button
            onClick={handleBuyAddon}
            disabled={loadingAddon}
            className={`w-full rounded-xl p-4 border transition-all text-left ${
              isPro
                ? "bg-primary/5 border-primary/30 hover:border-primary/50"
                : "bg-secondary border-border hover:border-primary/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                {loadingAddon ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Sparkles className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {isPro ? "The Offer" : "The Quick Fix"}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Add 5 more Podcasts for <span className="font-bold text-foreground">$2.99</span>
                </p>
                <p className="text-muted-foreground text-[10px] mt-1">One-time purchase · Instant access</p>
              </div>
            </div>
          </button>

          {/* Show upgrade option only for non-Pro users */}
          {!isPro && (
            <button
              onClick={() => navigate("/pricing")}
              className="w-full rounded-xl p-4 border bg-primary/5 border-primary/30 hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary" /> The Smart Move
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Upgrade to Pro for <span className="font-bold text-foreground">$9.99/mo</span>
                  </p>
                  <p className="text-muted-foreground text-[10px] mt-1">17 Podcasts + unlimited uploads & AI Tutor</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PodcastLimitModal;
