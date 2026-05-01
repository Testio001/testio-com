import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

interface Props {
  signupAt: string | null | undefined;
  userPlan: string | null;
}

const DURATION_MS = 24 * 60 * 60 * 1000;

const format = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const FirstWeekDiscountBanner = ({ signupAt, userPlan }: Props) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("first24h_banner_dismissed") === "1";
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!signupAt || dismissed) return null;
  if (userPlan && userPlan !== "free") return null;

  const start = new Date(signupAt).getTime();
  if (Number.isNaN(start)) return null;

  const remaining = start + DURATION_MS - now;
  if (remaining <= 0) return null;

  const dismiss = () => {
    localStorage.setItem("first24h_banner_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-primary via-primary/90 to-primary/70 text-primary-foreground px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-sm">
      <button
        onClick={() => navigate("/pricing")}
        className="flex items-center gap-2 sm:gap-3 text-left flex-1 min-w-0"
      >
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold leading-tight truncate">
            🎉 Welcome bonus: 50% OFF your first month
          </p>
          <p className="text-[10px] sm:text-xs opacity-90 leading-tight">
            Ends in <span className="font-mono font-semibold">{format(remaining)}</span> · Tap to upgrade
          </p>
        </div>
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 rounded hover:bg-black/10 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FirstWeekDiscountBanner;