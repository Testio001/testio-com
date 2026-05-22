import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, ArrowLeft, Loader2, Zap, Sparkles, GraduationCap, Star, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";
import testioLogo from "@/assets/testio-logo.png";
import ElitePricingBanner from "@/components/app/ElitePricingBanner";
import { useCurrency, NGN_PRICES, formatNgn } from "@/hooks/useCurrency";
import ComparisonReceipt from "@/components/app/ComparisonReceipt";

type PlanId = "free" | "starter" | "basic" | "pro" | "scholar";

const testimonials = [
  {
    quote:
      "I was honestly failing my exams. I'd read for hours and remember nothing. I started turning every chapter into a Testio podcast and listening on my way to school — my last test I scored 82%. I almost cried.",
    name: "Amaka O.",
    role: "300L Microbiology Student",
    initials: "AO",
  },
  {
    quote:
      "Reading PDFs used to put me to sleep. Now I upload my lecture notes, get a podcast in 30 seconds, and revise while I cook. I've never felt this prepared for finals in my life.",
    name: "Daniel K.",
    role: "Final Year Law Student",
    initials: "DK",
  },
  {
    quote:
      "I have ADHD and sitting still to study is torture. The AI quizzes and podcasts make studying feel like a game. I went from a 2.4 GPA to a 3.7 in one semester. This app changed my life — no exaggeration.",
    name: "Priya S.",
    role: "Pre-Med, 2nd Year",
    initials: "PS",
  },
  {
    quote:
      "I'm a working mum trying to finish my MBA. I have zero free time. Testio turns my readings into podcasts I listen to while doing dishes. I passed my last two courses with distinction. Worth every naira.",
    name: "Funmi A.",
    role: "MBA Candidate",
    initials: "FA",
  },
];

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
  ngnOnly?: boolean;
}> = [
  {
    id: "free",
    name: "Free",
    tagline: "Dip your toes in",
    price: "$0",
    period: "Forever free",
    blurb: "Less than nothing",
    features: [
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
    id: "starter",
    name: "Starter",
    tagline: "For Nigerian students on a budget",
    price: formatNgn(NGN_PRICES.starter),
    period: "/30 days",
    blurb: "Most affordable way in",
    features: [
      "📄 10 uploads / month",
      "📝 AI Summaries Unlimited (High-speed extraction)",
      "🃏 20 Flashcard packs",
      "🧠 AI Quizzes (20 questions)",
      "🤖 AI Tutor (10 q's per doc)",
      "❌ No podcast — upgrade to Basic+ for podcasts",
    ],
    highlight: false,
    cta: "Subscribe",
    badge: "STARTER",
    ngnOnly: true,
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
    price: "$19.99",
    period: "/mo",
    blurb: "Less than a single textbook",
    features: [
      "♾️ Unlimited uploads*",
      "📝 AI Summaries & Flashcards",
      "🧠 Unlimited AI Quizzes",
      "🎙️ 9 Podcasts / month (15 min)",
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
  const { currency, setCurrency, isNigeria } = useCurrency();
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const fetchActivePlan = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("subscription_plan, subscription_expires_at")
      .eq("user_id", user.id)
      .single();
    if (!data) {
      setActivePlan("free");
      return "free";
    }
    const plan = data.subscription_plan || "free";
    if (plan !== "free" && data.subscription_expires_at) {
      if (new Date(data.subscription_expires_at) < new Date()) {
        setActivePlan("free");
        return "free";
      }
    }
    setActivePlan(plan);
    return plan;
  };

  useEffect(() => {
    if (user) fetchActivePlan();
  }, [user]);

  // ---- Lemon Squeezy (USD) success handler ----
  // Trigger whenever ANY `payment` param is present (Lemon Squeezy sometimes
  // strips/changes the value). Poll verify-payment up to 3x every 3s because
  // the webhook may take 5-10s to land.
  useEffect(() => {
    if (!user) return;
    const paymentParam = searchParams.get("payment");
    if (!paymentParam) return;
    let cancelled = false;

    const run = async () => {
      const tryVerify = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", { body: {} });
          if (error) return false;
          return !!data?.success ? data : false;
        } catch {
          return false;
        }
      };

      let result: any = await tryVerify();
      let attempts = 0;
      while (!result && attempts < 3 && !cancelled) {
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelled) return;
        result = await tryVerify();
        attempts++;
      }
      if (cancelled) return;
      if (result) {
        toast({
          title: "🎉 Payment Successful!",
          description: result.plan
            ? `Welcome to Testio ${result.plan}! Enjoy your premium features.`
            : "Your subscription is now active!",
        });
        await fetchActivePlan();
        navigate("/dashboard", { replace: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, user]);

  // ---- Korapay (NGN) success handler ----
useEffect(() => {
  if (!user) return;

  const reference = searchParams.get("reference");
  if (!reference) return;

  let cancelled = false;

  const run = async () => {
    const tryVerify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("korapay-verify", {
          body: { reference },
        });

        if (error) {
          console.error("Korapay verify error:", error);
          return false;
        }

        return !!data?.success ? data : false;
      } catch (err) {
        console.error("Korapay verify failed:", err);
        return false;
      }
    };

    let result: any = await tryVerify();
    let attempts = 0;

    while (!result && attempts < 3 && !cancelled) {
      await new Promise((r) => setTimeout(r, 3000));

      if (cancelled) return;

      result = await tryVerify();
      attempts++;
    }

    if (cancelled) return;

    if (result) {
      toast({
        title: "🎉 Payment successful",
        description: "Your subscription is now active and valid for 30 days.",
      });

      // Refresh active plan immediately
      await fetchActivePlan();

      // Remove payment params from URL WITHOUT redirecting
      window.history.replaceState({}, "", "/pricing");
    } else {
      toast({
        title: "Payment pending",
        description: "We're still confirming your payment. Please wait a moment.",
      });
    }
  };

  run();

  return () => {
    cancelled = true;
  };
}, [searchParams, user]);
  // ---- Bulletproof fallback auto-sync ----
  // On mount (and whenever the user changes), scan for any pending Korapay
  // transactions started in the last 60 minutes and force-verify each one.
  // Lemon Squeezy has no local pending table, so we also fire a best-effort
  // verify-payment which now falls back to scanning Lemon Squeezy orders by
  // email for the past 24h. Runs silently in the background.
  useEffect(() => {
    if (!user) return;
    // Skip when an explicit handler above is already running
    if (searchParams.get("payment") || searchParams.get("reference")) return;
    let cancelled = false;

    (async () => {
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // --- Korapay pending sweep ---
      try {
        const { data: pending } = await supabase
          .from("korapay_transactions")
          .select("reference, status, created_at")
          .eq("user_id", user.id)
          .neq("status", "success")
          .gte("created_at", sixtyMinutesAgo)
          .order("created_at", { ascending: false });

        if (!cancelled && pending && pending.length > 0) {
          for (const tx of pending) {
            if (cancelled) return;
            try {
              const { data: vr } = await supabase.functions.invoke("korapay-verify", {
                body: { reference: tx.reference },
              });
              if (vr?.success) {
                toast({
                  title: "🎉 Payment confirmed",
                  description: vr.addon
                    ? "5 podcast credits have been added to your account."
                    : `Your ${vr.plan} plan is active for 30 days.`,
                });
                await fetchActivePlan();
                navigate("/dashboard", { replace: true });
                return;
              }
            } catch {
              /* silent */
            }
          }
        }
      } catch {
        /* silent */
      }

      // --- Lemon Squeezy best-effort sweep ---
      // verify-payment now checks recent paid orders by email if the local
      // profile is still on free, so calling it once on load self-heals
      // missed webhooks.
      try {
        const { data: vr } = await supabase.functions.invoke("verify-payment", { body: {} });
        if (!cancelled && vr?.success && vr?.plan) {
          const before = activePlan;
          await fetchActivePlan();
          if (before === "free" || !before) {
            toast({
              title: "🎉 Payment Successful!",
              description: `Welcome to Testio ${vr.plan}! Enjoy your premium features.`,
            });
            navigate("/dashboard", { replace: true });
          }
        }
      } catch {
        /* silent */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const handleSubscribe = async (plan: (typeof plans)[0]) => {
    if (plan.id === "free") {
      navigate("/dashboard");
      return;
    }
    if (activePlan && activePlan === plan.id) {
      toast({ title: "You're already on this plan", description: "Enjoy your premium features!" });
      return;
    }
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoadingPlan(plan.id);
    try {
      const fnName = currency === "NGN" ? "korapay-initialize" : "initialize-payment";

      // FIXED HERE: Passing the dynamic domain source context so it doesn't default back to lovable
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          plan: plan.id,
          frontendOrigin: window.location.origin,
        },
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
          <span className="text-foreground font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            testio
          </span>
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
            Start free. Upgrade any time. {currency === "NGN" ? "One-off payment, valid 30 days." : "Cancel any time."}
          </p>

          {/* NG-only: toggle auto-renewing USD subscription on/off */}
          {isNigeria && (
            <div className="mt-5">
              <button
                onClick={() => setCurrency(currency === "NGN" ? "USD" : "NGN")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-all"
              >
                {currency === "NGN" ? "🔄 Activate auto-renewal" : "↩️ Deactivate auto-renewal (back to ₦)"}
              </button>
            </div>
          )}
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans
            .filter((p) => !p.ngnOnly || (currency === "NGN" && isNigeria))
            .map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-2xl p-6 border flex flex-col ${
                  plan.highlight
                    ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/10"
                    : plan.id === "starter"
                      ? "bg-card border-amber-500/30"
                      : "bg-card border-border"
                }`}
              >
                {plan.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground"
                        : plan.id === "starter"
                          ? "bg-amber-500 text-black"
                          : "bg-foreground text-background"
                    }`}
                  >
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    {plan.id === "scholar" ? (
                      <GraduationCap className="w-5 h-5 text-primary" />
                    ) : plan.highlight ? (
                      <Zap className="w-5 h-5 text-primary" />
                    ) : (
                      <Crown className="w-5 h-5 text-primary/70" />
                    )}
                    <h3 className="text-foreground font-bold text-lg">{plan.name}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs">{plan.tagline}</p>
                </div>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {currency === "NGN" && plan.id !== "free"
                      ? formatNgn(NGN_PRICES[plan.id as Exclude<PlanId, "free">])
                      : plan.price}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {plan.id === "free" ? plan.period : currency === "NGN" ? "/30 days" : plan.period}
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] italic mb-5">
                  {currency === "NGN" && plan.id !== "free" ? "One-off payment · renew when it expires" : plan.blurb}
                </p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-foreground leading-snug">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  const isCurrent =
                    activePlan === plan.id || (plan.id === "free" && (!activePlan || activePlan === "free"));
                  return (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={loadingPlan !== null || plan.id === "free" || isCurrent}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? "bg-primary/15 text-primary border border-primary/40 cursor-default"
                          : plan.highlight
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : plan.id === "free"
                              ? "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                              : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                      } disabled:opacity-100`}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        <>
                          <BadgeCheck className="w-4 h-4" /> Subscribed · Current Plan
                        </>
                      ) : (
                        plan.cta
                      )}
                    </button>
                  );
                })()}
              </motion.div>
            ))}
        </div>

        <div className="text-center mt-8 space-y-1">
          <p className="text-muted-foreground text-xs">*Scholar fair-usage cap: 80 uploads/month to prevent abuse.</p>
          <p className="text-muted-foreground text-xs">
            {currency === "NGN"
              ? "Secure payment powered by Korapay (Nigeria). One-off — no auto-renew."
              : "Secure payment powered by Lemon Squeezy. Cancel anytime."}
          </p>
          <p className="text-muted-foreground text-[10px]">
            Created by <span className="font-semibold">TechWorld</span>
          </p>
        </div>

        <ComparisonReceipt />

        {/* Testimonials */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Loved by students who used to struggle
            </h2>
            <p className="text-muted-foreground text-xs max-w-md mx-auto">
              Real stories from real students who turned their grades around.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-card border border-border rounded-2xl p-5 transition-shadow hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30"
              >
                <div className="flex items-center gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-foreground text-xs leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-foreground font-semibold text-xs">{t.name}</div>
                    <div className="text-muted-foreground text-[10px]">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Pricing;
