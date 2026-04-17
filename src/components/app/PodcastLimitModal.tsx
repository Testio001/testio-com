import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Zap, Crown, Loader2, X, Sparkles } from "lucide-react";

interface PodcastLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionPlan: string; // free | basic | pro | scholar
}

const PodcastLimitModal = ({ isOpen, onClose, subscriptionPlan }: PodcastLimitModalProps) => {
  const navigate = useNavigate();
  const [loadingAddon, setLoadingAddon] = useState(false);
  const isFree = subscriptionPlan === "free";
  const isPaid = ["basic", "pro", "scholar"].includes(subscriptionPlan);

  const handleBuyAddon = async () => {
    setLoadingAddon(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { plan: "podcast_addon" },
      });
      if (error) throw error;
      if (data?.checkout_url) window.location.href = data.checkout_url;
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
            {isFree
              ? "Free plan only includes 1 podcast. Upgrade to keep listening!"
              : "You've used all your podcast credits for this month. Top up to keep learning on the go!"}
          </p>
        </div>

        <div className="space-y-3">
          {/* Free users: only show upgrade options (no top-up) */}
          {isFree && (
            <>
              <button
                onClick={() => navigate("/pricing")}
                className="w-full rounded-xl p-4 border bg-secondary border-border hover:border-primary/40 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Upgrade to Basic — $4.99/mo</p>
                    <p className="text-muted-foreground text-xs mt-0.5">3 podcasts/month (7 min) + 15 uploads</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate("/pricing")}
                className="w-full rounded-xl p-4 border bg-primary/5 border-primary/30 hover:border-primary/50 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Upgrade to Pro — $9.99/mo</p>
                    <p className="text-muted-foreground text-xs mt-0.5">6 podcasts/month (12 min) + 40 uploads</p>
                  </div>
                </div>
              </button>
            </>
          )}

          {/* Paid users only: top-up addon */}
          {isPaid && (
            <button
              onClick={handleBuyAddon}
              disabled={loadingAddon}
              className="w-full rounded-xl p-4 border bg-primary/5 border-primary/30 hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  {loadingAddon ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Sparkles className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Get More Podcasts</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Add <span className="font-bold text-foreground">5 podcasts</span> for <span className="font-bold text-foreground">$4.99</span>
                  </p>
                  <p className="text-muted-foreground text-[10px] mt-1 italic">
                    One-time top-up · Adds 5 podcast credits only (no other features)
                  </p>
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
