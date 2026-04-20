import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, ArrowLeft, Loader2, Zap, Sparkles, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import testioLogo from "@/assets/testio-logo.png";
import ElitePricingBanner from "@/components/app/ElitePricingBanner";

type PlanId = "free" | "basic" | "pro" | "scholar";

const plans: Array<{
  id: PlanId;
  name: string;
  tagline: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  highlight: boolean;
  cta: string;
  badge?: string;
}> = [
  {
    id: "free",
    name: "Free",
    tagline: "Dip your toes in",
    price: "$0",
    period: "Forever free",
    blurb: "Less than nothing",
    features: [
      "📄 3 uploads (lifetime)",
      "📝 AI Summaries & Flashcards",
      "🧠 AI Quizzes (20 questions)",
      "🎙️ 1 Study Podcast (4 min, lifetime)",
      "🤖 AI Tutor (5 q's per doc)",
      "🎁 Bonus uploads via referrals",
    ],
    highlight: false,
    cta: "Current Plan",
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "For the casual studier",
    price: "$4.99",
    period: "/mo",
    blurb: "Less than a coffee/week",
    features: [
      "📄 15 uploads / month",
      "📝 AI Summaries & Flashcards",
      "🧠 AI Quizzes (20 questions)",
      "🎙️ 3 Podcasts / month (7 min)",
      "🤖 AI Tutor (21 q's per doc)",
      "🎁 Bonus uploads via referrals",
    ],
    highlight: false,
    cta: "Subscribe",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Your whole semester sorted",
    price: "$9.99",
    period: "/mo",
    blurb: "Less than one textbook/year",
    features: [
      "📄 40 uploads / month",
      "📝 AI Summaries & Flashcards",
      "🧠 Unlimited AI Quizzes",
      "🎙️ 6 Podcasts / month (12 min)",
      "🤖 AI Tutor (21 q's per doc)",
      "⚡ Priority processing",
      "🎁 Bonus uploads via referrals (uploads only)",
    ],
    highlight: true,
    cta: "Subscribe",
    badge: "MOST POPULAR",
  },
  {
    id: "scholar",
    name: "Scholar",
    tagline: "When grades are everything",
    price: "$14.99",
    period: "/mo",
    blurb: "Less than a single textbook",
    features: [
      "♾️ Unlimited uploads*",
      "📝 AI Summaries & Flashcards",
      "🧠 Unlimited AI Quizzes",
      "🎙️ 12 Podcasts / month (15 min)",
      "🤖 Unlimited AI Tutor",
      "⚡ Priority processing",
      "🔬 Early access to new features",
      "🎁 Bonus uploads via referrals",
    ],
    highlight: false,
    cta: "Subscribe",
    badge: "BEST VALUE",
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAndroidApp = useIsAndroidApp();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("payment") === "success" && user) {
      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", { body: {} });
          if (error) throw error;
          if (data?.success) {
            toast({
              title: "🎉 Payment Successful!",
              description: `Welcome to Testio ${data.plan}! Enjoy your premium features.`,
            });
            navigate("/dashboard", { replace: true });
          } else {
            setTimeout(async () => {
              const { data: retryData } = await supabase.functions.invoke("verify-payment", { body: {} });
              if (retryData?.success) {
                toast({ title: "🎉 Payment Successful!", description: `Your subscription is now active!` });
                navigate("/dashboard", { replace: true });
              }
            }, 5000);
          }
        } catch {
          // silent — webhook handles it
        }
      };
      verifyPayment();
    }
  }, [searchParams, user]);

  if (isAndroidApp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Premium Features</h1>
          <p className="text-muted-foreground text-sm">
            Manage your subscription from the Testio website at testio.online
          </p>
        </div>
      </div>
    );
  }

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (plan.id === "free") {
      navigate("/dashboard");
      return;
    }
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoadingPlan(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { plan: plan.id },
      });
      if (error) throw error;
      if (data?.checkout_url) window.location.href = data.checkout_url;
    } catch (err: any) {
      toast({
        title: "Payment error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={testioLogo} alt="Testio" className="w-7 h-7" />
          <span className="text-foreground font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <ElitePricingBanner />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Choose Your Plan
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Pick the plan that fits you</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Start free. Upgrade any time. Cancel any time.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-2xl p-6 border flex flex-col ${
                plan.highlight
                  ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/10"
                  : "bg-card border-border"
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                  plan.highlight ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {plan.id === "scholar" ? <GraduationCap className="w-5 h-5 text-primary" /> :
                   plan.highlight ? <Zap className="w-5 h-5 text-primary" /> :
                   <Crown className="w-5 h-5 text-primary/70" />}
                  <h3 className="text-foreground font-bold text-lg">{plan.name}</h3>
                </div>
                <p className="text-muted-foreground text-xs">{plan.tagline}</p>
              </div>

              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground text-xs">{plan.period}</span>
              </div>
              <p className="text-muted-foreground text-[11px] italic mb-5">{plan.blurb}</p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-foreground leading-snug">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loadingPlan !== null || plan.id === "free"}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : plan.id === "free"
                    ? "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                } disabled:opacity-50`}
              >
                {loadingPlan === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 space-y-1">
          <p className="text-muted-foreground text-xs">*Scholar fair-usage cap: 80 uploads/month to prevent abuse.</p>
          <p className="text-muted-foreground text-xs">Secure payment powered by Lemon Squeezy. Cancel anytime.</p>
          <p className="text-muted-foreground text-[10px]">Created by <span className="font-semibold">TechWorld</span></p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
