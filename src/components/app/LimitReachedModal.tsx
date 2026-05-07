import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Zap, Clock, Gift } from "lucide-react";
import { useCurrency, priceFor, periodFor, entryPlanFor } from "@/hooks/useCurrency";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";

interface Props {
  open: boolean;
  onClose: () => void;
  onRefer: () => void;
  signupAt: string | null | undefined;
  type?: "upload" | "podcast" | "quiz";
}

const FIRST_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
};

const LimitReachedModal = ({ open, onClose, onRefer, signupAt, type = "upload" }: Props) => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const isAndroidApp = useIsAndroidApp();
  const [now, setNow] = useState(Date.now());
  const entryPlan = entryPlanFor(currency);
  const entryPrice = priceFor(entryPlan, currency);
  const proPrice = priceFor("pro", currency);
  const period = periodFor(currency);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const start = signupAt ? new Date(signupAt).getTime() : 0;
  const remaining = start ? start + FIRST_WEEK_MS - now : 0;
  const inFirstWeek = remaining > 0;

  const titleByType =
    type === "podcast" ? "Podcast limit reached" : type === "quiz" ? "Quiz limit reached" : "You've used all your free uploads";
  const subByType =
    type === "podcast"
      ? "Free plan includes 1 short podcast. Upgrade for full-length study podcasts."
      : type === "quiz"
      ? "Free plan caps quiz questions. Unlock unlimited Q&A with a paid plan."
      : "Don't lose momentum — keep generating notes, flashcards, quizzes & podcasts.";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border-2 border-primary/40 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl shadow-primary/20 relative"
          >
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary">
              <X className="w-4 h-4" />
            </button>

            {inFirstWeek && !isAndroidApp && (
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground rounded-xl px-3 py-2 mb-4 flex items-center gap-2"
              >
                <Clock className="w-4 h-4 shrink-0" />
                <div className="text-xs font-bold leading-tight flex-1 min-w-0">
                  <div>🔥 First-week 30% OFF — ends in</div>
                  <div className="font-mono text-sm">{fmt(remaining)}</div>
                </div>
              </motion.div>
            )}

            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-foreground font-bold text-base sm:text-lg leading-tight">{titleByType}</h3>
                <p className="text-muted-foreground text-xs mt-1">{subByType}</p>
              </div>
            </div>

            <div className="bg-secondary/60 rounded-xl p-3 mb-4 space-y-1.5">
              <Row text={`📄 15+ uploads / month`} />
              <Row text={`🎙️ Full-length study podcasts`} />
              <Row text={`🤖 21+ AI Tutor questions per doc`} />
              <Row text={`⚡ Priority processing`} />
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-muted-foreground text-xs">From</span>
              <span className="text-2xl font-bold text-foreground">{entryPrice}</span>
              <span className="text-muted-foreground text-xs">{period}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Pro: {proPrice}{period}</span>
            </div>

            {!isAndroidApp ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { onClose(); navigate("/pricing"); }}
                  className="btn-testio-primary w-full text-sm !py-3 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> {inFirstWeek ? "Claim 30% off & upgrade" : "Upgrade now"}
                </button>
                <button
                  onClick={() => { onClose(); onRefer(); }}
                  className="w-full py-2.5 bg-secondary hover:bg-secondary/80 rounded-full text-xs font-medium text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" /> Or refer a friend for a bonus upload
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs text-center">
                Manage your subscription at testio.online from a browser.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Row = ({ text }: { text: string }) => (
  <p className="text-foreground text-xs">{text}</p>
);

export default LimitReachedModal;