import { useNavigate } from "react-router-dom";
import { BookOpen, Brain, Headphones, MessageCircle, Check, ArrowRight, Gift, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";
import { useCurrency, NGN_PRICES, formatNgn } from "@/hooks/useCurrency";

const features = [
  {
    icon: BookOpen,
    title: "PDF to Summary",
    description: "Upload any PDF and get clear, concise summaries powered by AI in seconds.",
  },
  {
    icon: Brain,
    title: "AI-Generated Quizzes",
    description: "Automatically create practice quizzes from your study materials to test your knowledge.",
  },
  {
    icon: Headphones,
    title: "Study Podcasts",
    description: "Convert your notes into engaging audio podcasts you can listen to anywhere.",
  },
  {
    icon: MessageCircle,
    title: "24/7 AI Tutor",
    description: "Ask questions about your documents and get instant, accurate explanations.",
  },
];

type HomePlan = {
  id: "free" | "basic" | "pro" | "scholar";
  name: string;
  features: string[];
  highlight: boolean;
  cta: string;
};

const plans: HomePlan[] = [
  {
    id: "free",
    name: "Free",
    features: [
      "3 uploads (lifetime)",
      "AI Summaries & Flashcards",
      "AI Quizzes (20 questions)",
      "1 Study Podcast (4 min, lifetime)",
      "AI Tutor (5 q's per doc)",
      "Bonus uploads via referrals",
    ],
    highlight: false,
    cta: "Start Free",
  },
  {
    id: "basic",
    name: "Basic",
    features: [
      "15 uploads / month",
      "AI Summaries & Flashcards",
      "AI Quizzes (20 questions)",
      "3 Podcasts / month (7 min)",
      "AI Tutor (21 q's per doc)",
    ],
    highlight: false,
    cta: "Subscribe",
  },
  {
    id: "pro",
    name: "Pro",
    features: [
      "40 uploads / month",
      "Unlimited AI Quizzes",
      "6 Podcasts / month (12 min)",
      "AI Tutor (21 q's per doc)",
      "Priority processing",
    ],
    highlight: true,
    cta: "Subscribe",
  },
  {
    id: "scholar",
    name: "Scholar",
    features: [
      "Unlimited uploads*",
      "Unlimited AI Quizzes",
      "12 Podcasts / month (15 min)",
      "Unlimited AI Tutor",
      "Early access to new features",
    ],
    highlight: false,
    cta: "Subscribe",
  },
];

const USD_LABELS: Record<HomePlan["id"], { price: string; period: string }> = {
  free: { price: "$0", period: "" },
  basic: { price: "$4.99", period: "/mo" },
  pro: { price: "$9.99", period: "/mo" },
  scholar: { price: "$14.99", period: "/mo" },
};

const Home = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const { currency, setCurrency } = useCurrency();

  return (
    <div className={`min-h-screen transition-colors ${isDark ? "bg-gray-950 text-gray-100" : "bg-white text-gray-900"}`}>
      {/* Navbar */}
      <nav className={`border-b px-6 py-4 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#4f46e5" }}>
            testio
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                isDark
                  ? "border-gray-700 text-gray-300 hover:bg-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className={`text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Master Your Studies{" "}
            <span className="text-indigo-600">with AI</span>
          </h1>
          <p className={`text-xl max-w-2xl mx-auto mb-10 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Turn PDFs into summaries, quizzes, and podcasts in seconds. Study smarter, not harder.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className={`py-20 px-6 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Everything You Need to Study Smarter</h2>
          <p className={`text-center mb-14 max-w-xl mx-auto ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Powerful AI tools that transform how you learn and retain information.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <button
                key={feature.title}
                onClick={() => navigate("/auth")}
                className={`text-left rounded-2xl p-6 border transition-all ${
                  isDark
                    ? "bg-gray-950 border-gray-800 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-900/30"
                    : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isDark ? "bg-indigo-950" : "bg-indigo-50"}`}>
                  <feature.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>{feature.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>{feature.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Product Walkthrough */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className={`text-3xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>See Testio in Action</h2>
          <p className={`mb-10 max-w-2xl mx-auto ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Watch a full 7-minute deep dive into how Testio transforms your study materials.
          </p>
          <div className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src="https://www.loom.com/embed/8f58c3a8db8c4ec3b6efa8cdd5d52781"
                frameBorder="0"
                allowFullScreen
                className="absolute inset-0 w-full h-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Simple, Transparent Pricing</h2>
          <p className={`text-center mb-14 max-w-md mx-auto ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Choose the plan that fits your study needs. Cancel anytime.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-7 border ${
                  plan.highlight
                    ? isDark
                      ? "bg-indigo-950/40 border-indigo-700 shadow-xl"
                      : "bg-indigo-50 border-indigo-300 shadow-xl"
                    : isDark
                      ? "bg-gray-900 border-gray-800"
                      : "bg-white border-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className={`font-bold text-xl mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                  {plan.period && <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className={`flex items-start gap-2.5 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/auth")}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                      : isDark
                        ? "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral Section */}
      <section className={`py-20 px-6 ${isDark ? "bg-indigo-950/30" : "bg-indigo-50"}`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isDark ? "bg-indigo-900/50" : "bg-indigo-100"}`}>
            <Gift className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className={`text-3xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Invite Friends, Earn Free Uploads</h2>
          <p className={`max-w-2xl mx-auto mb-10 text-lg ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Love Testio? Share it with your classmates! For every friend who signs up using your referral link, 
            you both get <span className="font-bold text-indigo-500">bonus uploads</span> and 
            <span className="font-bold text-indigo-500"> streak rewards</span>. The more you share, the more you earn.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
            <div className="bg-white rounded-xl p-6 border border-indigo-100">
              <div className="text-3xl font-extrabold text-indigo-600 mb-2">1</div>
              <p className="text-sm text-gray-700 font-medium">Share your unique referral link</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-indigo-100">
              <div className="text-3xl font-extrabold text-indigo-600 mb-2">2</div>
              <p className="text-sm text-gray-700 font-medium">Your friend signs up & uploads</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-indigo-100">
              <div className="text-3xl font-extrabold text-indigo-600 mb-2">3</div>
              <p className="text-sm text-gray-700 font-medium">You both earn bonus uploads & streak perks</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Users className="w-5 h-5" /> Start Referring
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`border-t py-12 px-6 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-gray-50"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <span className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#4f46e5" }}>
                testio
              </span>
              <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>AI-powered study tools for students.</p>
            </div>
            <div className={`flex flex-wrap items-center gap-6 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              <a href="/terms" className="hover:text-indigo-500 transition-colors">Terms of Service</a>
              <a href="/terms" className="hover:text-indigo-500 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-indigo-500 transition-colors">Refund Policy</a>
              <a href="mailto:support@testio.online" className="hover:text-indigo-500 transition-colors">Contact Us</a>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-1">
            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>© 2025 Testio. All rights reserved.</p>
            <p className={`text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>Created by <span className={`font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}>TechWorld</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
