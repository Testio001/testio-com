import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Check, Zap } from "lucide-react";

interface Props {
  signupAt: string | null | undefined;
  userPlan: string | null;
}

const DURATION_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "welcome_discount_modal_seen_v1";

const format = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const WelcomeDiscountModal = ({ signupAt, userPlan }: Props) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  // Decide whether to open on mount
  useEffect(() => {
    if (!signupAt) return;
    if (userPlan && userPlan !== "free") return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;

    const start = new Date(signupAt).getTime();
    if (Number.isNaN(start)) return;
    const remaining = start + DURATION_MS - Date.now();
    if (remaining <= 0) return;

    // Small delay so it doesn't clash with auth redirect / page paint
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [signupAt, userPlan]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !signupAt) return null;
  const start = new Date(signupAt).getTime();
  const remaining = start + DURATION_MS - now;
  if (remaining <= 0) return null;

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const claim = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    navigate("/pricing?plan=pro");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-discount-title"
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar with dismiss */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground pl-1">Welcome offer</span>
        <button
          onClick={close}
          aria-label="Cancel and close"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-y-auto">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center mb-6 shadow-xl shadow-primary/30">
          <Sparkles className="w-10 h-10" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold mb-4 uppercase tracking-wide">
          <Zap className="w-3.5 h-3.5" /> Welcome bonus · Today only
        </div>

        <h2
          id="welcome-discount-title"
          className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight max-w-md mb-3"
        >
          50% OFF your first month
        </h2>
        <p className="text-muted-foreground text-base max-w-sm mb-6">
          A one-time welcome gift for new students. Unlock unlimited podcasts, quizzes, and your AI tutor.
        </p>

        {/* Countdown */}
        <div className="bg-secondary border border-border rounded-2xl px-6 py-4 mb-8">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Offer ends in</p>
          <p className="text-3xl font-mono font-bold text-foreground tabular-nums">{format(remaining)}</p>
        </div>

        {/* Quick benefits */}
        <ul className="text-left space-y-2 mb-8 max-w-xs w-full">
          {[
            "Unlimited AI summaries & quizzes",
            "Study podcasts on the go",
            "Priority processing for big PDFs",
          ].map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sticky CTA */}
      <div className="px-5 pt-3 pb-5 border-t border-border bg-background">
        <button
          onClick={claim}
          className="w-full bg-primary text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.99] transition-transform"
        >
          Claim 50% Off →
        </button>
        <button
          onClick={close}
          className="w-full mt-3 py-3 rounded-2xl border border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
        >
          Cancel · No thanks
        </button>
      </div>
    </div>
  );
};

export default WelcomeDiscountModal;
