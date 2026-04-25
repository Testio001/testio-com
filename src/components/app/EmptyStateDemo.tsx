import { motion } from "framer-motion";
import { FileText, BookOpen, Brain, Sparkles, ArrowRight } from "lucide-react";

/**
 * Looping animated preview shown in the dashboard empty state.
 * Cycles through: PDF upload → AI processing → Notes / Flashcards / Quiz.
 * Pure CSS/framer-motion (no GIF asset) so it stays crisp & themed.
 */
const EmptyStateDemo = () => {
  return (
    <div className="mt-8 mx-auto max-w-md">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-3">
        Here's what happens after you upload
      </p>
      <div className="relative bg-testio-card border border-border/50 rounded-2xl p-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          {/* PDF */}
          <motion.div
            className="flex flex-col items-center gap-1.5"
            animate={{ y: [0, -4, 0], opacity: [1, 1, 0.6, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-12 h-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <span className="text-[10px] text-muted-foreground">PDF</span>
          </motion.div>

          <motion.div
            animate={{ x: [0, 6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>

          {/* AI core */}
          <motion.div
            className="w-12 h-12 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-5 h-5 text-primary" />
          </motion.div>

          <motion.div
            animate={{ x: [0, 6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>

          {/* Outputs - cycle which one is highlighted */}
          <div className="flex flex-col gap-1.5">
            {[
              { Icon: FileText, label: "Notes", delay: 0 },
              { Icon: BookOpen, label: "Cards", delay: 1.3 },
              { Icon: Brain, label: "Quiz", delay: 2.6 },
            ].map(({ Icon, label, delay }) => (
              <motion.div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40"
                animate={{
                  borderColor: ["hsl(var(--border) / 0.4)", "hsl(var(--primary))", "hsl(var(--border) / 0.4)"],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
              >
                <Icon className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Progress shimmer */}
        <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </div>
  );
};

export default EmptyStateDemo;