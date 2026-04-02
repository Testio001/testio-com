import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Brain, MessageSquare, Mic, ArrowRight, Sparkles, Moon, Sun, Check, Bell } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import testioLogo from "@/assets/testio-logo.png";

const steps = [
  {
    icon: FileText,
    title: "Upload Any Content",
    description: "Drop a PDF, paste text, or upload an image. Testio extracts and understands your material instantly.",
    color: "text-primary",
  },
  {
    icon: Brain,
    title: "AI-Powered Study Tools",
    description: "Get comprehensive notes, flashcards, quizzes, and even AI-generated podcasts — all from your content.",
    color: "text-testio-green",
  },
  {
    icon: Mic,
    title: "🎙️ Listen as a Podcast",
    description: "Your notes come alive as a two-person podcast with realistic AI voices. Perfect for learning on the go — commute, gym, or before bed.",
    color: "text-primary",
  },
  {
    icon: MessageSquare,
    title: "Chat With Your Notes",
    description: "Ask questions, get explanations, and dive deeper into topics with an AI assistant that knows your material.",
    color: "text-testio-green",
  },
  {
    icon: Bell,
    title: "Stay on Track",
    description: "Enable push notifications to get streak reminders, study nudges, and alerts when your AI study deck is ready.",
    color: "text-testio-green",
  },
  {
    icon: Sparkles,
    title: "Choose Your Theme",
    description: "Pick the look you want to start with. You can still change it anytime later in settings.",
    color: "text-primary",
  },
];

const themeOptions = [
  {
    value: "dark" as const,
    title: "Dark",
    description: "The default Testio look",
    icon: Moon,
  },
  {
    value: "light" as const,
    title: "Light",
    description: "A brighter workspace",
    icon: Sun,
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe, isLoading: pushLoading, isiOS, isPWA } = usePushNotifications();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);
  const { theme, setTheme } = useTheme();
  const isThemeStep = step === steps.length - 1;
  const isNotificationStep = step === 4; // The "Stay on Track" step
  const pushAvailable = pushSupported && !(isiOS && !isPWA);

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

            {isNotificationStep && pushAvailable && (
              <div className="mb-10">
                <button
                  type="button"
                  onClick={async () => {
                      try {
                        await pushSubscribe(true);
                      toast.success("Notifications enabled! 🔔");
                    } catch {
                      toast.error("Could not enable notifications");
                    }
                  }}
                  disabled={pushLoading || pushSubscribed}
                  className={`w-full rounded-2xl border p-4 transition-all ${
                    pushSubscribed
                      ? "border-primary bg-secondary shadow-[0_0_0_1px_hsl(var(--primary))]"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">
                          {pushSubscribed ? "Notifications Enabled ✓" : "Enable Push Notifications"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Streak reminders, study deck alerts & more
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        pushSubscribed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              </div>
            )}

            {isThemeStep && (
              <div className="grid gap-3 mb-10 text-left">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={`w-full rounded-2xl border p-4 transition-all ${
                        selected
                          ? "border-primary bg-secondary shadow-[0_0_0_1px_hsl(var(--primary))]"
                          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{option.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                          </div>
                        </div>

                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
