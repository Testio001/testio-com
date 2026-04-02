import { useNavigate } from "react-router-dom";
import { BookOpen, Brain, Headphones, MessageCircle, Check, ArrowRight } from "lucide-react";

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

const plans = [
  {
    name: "Testio Basic",
    price: "$5.99",
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
    name: "Testio Pro Unlimited",
    price: "$10.99",
    period: "/month",
    features: [
      "Unlimited uploads",
      "Full Podcast access (30/month)",
      "Unlimited AI Tutor",
      "Priority processing",
    ],
    highlight: true,
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#4f46e5" }}>
            testio
          </span>
          <button
            onClick={() => navigate("/auth")}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            Master Your Studies{" "}
            <span className="text-indigo-600">with AI</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
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
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Everything You Need to Study Smarter</h2>
          <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
            Powerful AI tools that transform how you learn and retain information.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-gray-500 mb-14 max-w-md mx-auto">
            Choose the plan that fits your study needs. Cancel anytime.
          </p>
          <div className="grid sm:grid-cols-2 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 border ${
                  plan.highlight
                    ? "bg-indigo-50 border-indigo-300 shadow-xl"
                    : "bg-white border-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-bold text-gray-900 text-xl mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700">
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
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200"
                  }`}
                >
                  Subscribe
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <span className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#4f46e5" }}>
                testio
              </span>
              <p className="text-gray-500 text-sm mt-1">AI-powered study tools for students.</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
              <a href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
              <a href="/terms" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-indigo-600 transition-colors">Refund Policy</a>
              <a href="mailto:support@testio.online" className="hover:text-indigo-600 transition-colors">Contact Us</a>
            </div>
          </div>
          <p className="text-center text-gray-400 text-xs mt-8">© 2025 Testio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
