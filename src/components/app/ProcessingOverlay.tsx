import { Loader2, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

interface ProcessingOverlayProps {
  open: boolean;
  title?: string;
  subtitle?: string;
}

const TIPS = [
  "💡 Use the AI Tutor to ask questions about any concept you don't understand.",
  "🎙️ Generate podcasts to study while commuting or walking.",
  "🧠 Flashcards are perfect for memorising definitions — try them daily.",
  "🔥 Keep a daily streak to unlock bonus uploads and badges.",
  "🎁 Invite friends with your referral link to earn extra uploads each month.",
  "📝 Quizzes help you spot weak areas before exams — review wrong answers!",
  "⚡ Pro users get priority processing and longer podcasts (12 min).",
  "📚 Upload clear, text-based PDFs for the best summaries.",
  "🏆 Climb the leaderboard by maintaining your study streak.",
  "☕ Did you know you can become a top student for less than the price of a weekly coffee?",
  "🚀 Scholar plan unlocks unlimited AI Tutor — never get stuck again.",
  "🎯 Top students study 30 min daily with AI flashcards. Join them on Pro.",
];

const ProcessingOverlay = ({ open, title = "Processing your document...", subtitle = "We're extracting and analysing your content. This usually takes 10–30 seconds." }: ProcessingOverlayProps) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTipIndex(Math.floor(Math.random() * TIPS.length));
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-auto" />
      <div className="relative w-full max-w-lg bg-card border-2 border-primary/40 rounded-3xl shadow-2xl shadow-primary/20 p-8 pointer-events-auto animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-5 relative">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <span className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">{subtitle}</p>

          <div className="w-full bg-secondary/60 rounded-2xl p-4 border border-border/50">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Did you know?</p>
                <p key={tipIndex} className="text-sm text-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-500">
                  {TIPS[tipIndex]}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-5">Please keep this page open.</p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingOverlay;
