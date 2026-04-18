import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, X, Sparkles } from "lucide-react";

const TIPS = [
  "Did you know you can become a top student for less than the price of a weekly coffee?",
  "Pro unlocks 6 podcasts per month — perfect for studying on the go.",
  "Scholar gives you unlimited AI Tutor questions — never get stuck again.",
  "Upgrade now to lock in Elite Member pricing — only 3 slots left at $4.99!",
  "Top students study 30 min daily with AI flashcards. Join them on Pro.",
  "Did you know? Pro users finish revision 3x faster than free users.",
];

const RecurringUpsellBanner = ({ userPlan }: { userPlan: string | null }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (userPlan !== "free") return;
    // First show after 3 minutes, then every 5 minutes
    const initial = setTimeout(() => {
      setTipIndex(Math.floor(Math.random() * TIPS.length));
      setVisible(true);
    }, 3 * 60 * 1000);
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
      setVisible(true);
    }, 5 * 60 * 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [userPlan]);

  if (!visible || userPlan !== "free") return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-card border-2 border-primary/40 rounded-2xl shadow-2xl shadow-primary/20 p-4 relative">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 pr-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Did you know?</p>
            <p className="text-foreground text-sm leading-snug mb-3">{TIPS[tipIndex]}</p>
            <button
              onClick={() => {
                setVisible(false);
                navigate("/pricing");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Crown className="w-3.5 h-3.5" /> See plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurringUpsellBanner;
