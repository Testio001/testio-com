import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Brain, MessageSquare, Mic, ArrowRight, Sparkles } from "lucide-react";
import testioLogo from "@/assets/testio-logo.png";

const steps = [
  {
    icon: FileText,
    title: "Upload Any Content",
    description: "Drop a PDF, paste text, or add a YouTube link. Testio extracts and understands your material instantly.",
    color: "text-primary",
  },
  {
    icon: Brain,
    title: "AI-Powered Study Tools",
    description: "Get comprehensive notes, flashcards, and quizzes generated from your content — all tailored to help you learn faster.",
    color: "text-testio-green",
  },
  {
    icon: Mic,
    title: "Listen as a Podcast",
    description: "Turn your notes into an engaging two-person podcast conversation. Learn on the go by listening to your study material.",
    color: "text-primary",
  },
  {
    icon: MessageSquare,
    title: "Chat With Your Notes",
    description: "Ask questions, get explanations, and dive deeper into topics with an AI assistant that knows your material.",
    color: "text-testio-green",
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      navigate("/auth");
    }
  };

  const handleSkip = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-testio-glow pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-2 mb-12">
          <img src={testioLogo} alt="Testio" className="w-10 h-10" />
          <span className="text-foreground font-bold text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-4 bg-border"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className={`w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-6 ${steps[step].color}`}>
              {(() => {
                const Icon = steps[step].icon;
                return <Icon className="w-10 h-10" />;
              })()}
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {steps[step].title}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-10 max-w-sm mx-auto">
              {steps[step].description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleNext}
            className="btn-testio-primary flex items-center justify-center gap-2 w-full"
          >
            {step < steps.length - 1 ? "Next" : "Get Started"}
            <ArrowRight className="w-4 h-4" />
          </button>

          {step < steps.length - 1 && (
            <button
              onClick={handleSkip}
              className="text-muted-foreground text-sm hover:text-foreground transition-colors py-2"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
