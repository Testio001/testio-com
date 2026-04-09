import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, ArrowLeft, Loader2, Zap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import testioLogo from "@/assets/testio-logo.png";

const plans = [
  {
    id: "basic" as const,
    name: "Testio Basic",
    price: "$4.99",
    period: "/month",
    features: [
      "25 uploads/month",
      "Summary + Quiz + Flashcards",
      "AI Tutor (Standard)",
      "Podcast (Max 5 mins, 5/month)",
    ],
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Testio Pro Unlimited",
    price: "$9.99",
    period: "/month",
    features: [
      "Unlimited uploads*",
      "Full Podcast access (30/month)",
      "Unlimited AI Tutor",
      "Priority processing",
    ],
    highlight: true,
    note: "*Fair usage policy applies.",
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAndroidApp = useIsAndroidApp();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Check for successful payment return
  useEffect(() => {
    if (searchParams.get("payment") === "success" && user) {
      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", {
            body: {},
          });

          if (error) throw error;

          if (data?.success) {
            toast({
              title: "🎉 Payment Successful!",
              description: `Welcome to Testio ${data.plan === "pro" ? "Pro" : "Basic"}! Enjoy your premium features.`,
            });
            navigate("/dashboard", { replace: true });
          } else {
            // Retry after a few seconds (webhook may not have arrived yet)
            setTimeout(async () => {
              const { data: retryData } = await supabase.functions.invoke("verify-payment", {
                body: {},
              });
              if (retryData?.success) {
                toast({
                  title: "🎉 Payment Successful!",
                  description: `Your subscription is now active!`,
                });
                navigate("/dashboard", { replace: true });
              }
            }, 5000);
          }
        } catch {
          // Silent fail - webhook will handle it
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

      if (data?.checkout_url) {
        // Redirect to Lemon Squeezy checkout
        window.location.href = data.checkout_url;
      }
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

      <div className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Upgrade Your Learning
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Choose Your Plan</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Unlock unlimited uploads, full podcasts, and AI-powered studying with no limits.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 border ${
                plan.highlight
                  ? "bg-primary/5 border-primary/30 shadow-lg shadow-primary/10"
                  : "bg-card border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  {plan.highlight ? (
                    <Zap className="w-5 h-5 text-primary" />
                  ) : (
                    <Crown className="w-5 h-5 text-primary/70" />
                  )}
                  <h3 className="text-foreground font-bold text-lg">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.note && (
                <p className="text-muted-foreground text-xs mb-4 italic">{plan.note}</p>
              )}

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                } disabled:opacity-50`}
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4" /> Subscribe Now
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 space-y-1">
          <p className="text-muted-foreground text-xs">Secure payment powered by Lemon Squeezy. Cancel anytime.</p>
          <p className="text-muted-foreground text-[10px]">Created by <span className="font-semibold">TechWorld</span></p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
