import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Brain, Headphones, FileText, X, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  docTitle: string;
  elapsedSeconds: number;
}

/**
 * Confetti-style celebration shown after a user's FIRST document finishes.
 * Pure CSS confetti — no extra dependency.
 */
const CelebrationScreen = ({ open, onClose, docTitle, elapsedSeconds }: Props) => {
  const [pieces] = useState(() =>
    Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 2,
      rotate: Math.random() * 360,
      color: ["#22c9a0", "#facc15", "#f472b6", "#60a5fa", "#a78bfa"][i % 5],
    }))
  );

  // Auto-dismiss after 12s if user doesn't interact
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
          onClick={onClose}
        >
          {/* Confetti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {pieces.map((p) => (
              <motion.div
                key={p.id}
                initial={{ y: -40, opacity: 1, rotate: 0 }}
                animate={{ y: "110vh", rotate: p.rotate + 720, opacity: 0 }}
                transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
                className="absolute w-2 h-3 rounded-sm"
                style={{ left: `${p.left}%`, backgroundColor: p.color }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card border-2 border-primary/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-primary/20"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", damping: 12 }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-primary/40"
              >
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
              </motion.div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                Your study pack is ready! 🎉
              </h2>
              <p className="text-muted-foreground text-xs sm:text-sm truncate">
                "{docTitle}"
              </p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
              <p className="text-foreground text-sm font-semibold mb-3 text-center">
                In just <span className="text-primary">{elapsedSeconds}s</span>, you can now:
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <Stat icon={Brain} value="100" label="flashcards" />
                <Stat icon={FileText} value="100" label="quiz questions" />
                <Stat icon={Headphones} value="7-min" label="podcast" />
                <Stat icon={BookOpen} value="study" label="notes" />
              </div>
            </div>

            <button
              onClick={onClose}
              className="btn-testio-primary w-full text-sm !py-3 flex items-center justify-center gap-2"
            >
              Open my study pack <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[11px] text-muted-foreground mt-3">
              Tap anywhere to dismiss
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Stat = ({ icon: Icon, value, label }: { icon: any; value: string; label: string }) => (
  <div className="bg-card border border-border rounded-xl p-2.5 flex items-center gap-2">
    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="min-w-0">
      <div className="text-foreground font-bold text-sm leading-tight">{value}</div>
      <div className="text-muted-foreground text-[10px] leading-tight truncate">{label}</div>
    </div>
  </div>
);

export default CelebrationScreen;