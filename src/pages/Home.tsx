import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileText,
  Headphones,
  Layers,
  ListChecks,
  MessageCircle,
  Moon,
  Play,
  Star,
  Sun,
  Upload,
  Sparkles,
  Gift,
  Menu,
  X,
} from "lucide-react";
import testioLogo from "@/assets/testio-logo.png";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency, NGN_PRICES, formatNgn } from "@/hooks/useCurrency";
import SampleDocumentGallery from "@/components/app/SampleDocumentGallery";
import CreatorRewardsPromo from "@/components/creator/CreatorRewardsPromo";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

type HomePlan = {
  id: "free" | "starter" | "basic" | "pro" | "scholar";
  name: string;
  blurb: string;
  features: string[];
  highlight: boolean;
  cta: string;
  ngnOnly?: boolean;
};

const plans: HomePlan[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Try every tool on a real document.",
    features: [
      "AI Summaries & Flashcards",
      "AI Quizzes (20 questions)",
      "1 Study Podcast (4 min, lifetime)",
      "AI Tutor (5 q's per doc)",
      "Bonus uploads via referrals",
    ],
    highlight: false,
    cta: "Start free",
  },
  {
    id: "starter",
    name: "Starter",
    blurb: "For light weekly revision.",
    features: [
      "10 uploads / month",
      "AI Summaries Unlimited",
      "20 Flashcard packs",
      "AI Quizzes (20 questions)",
      "AI Tutor (10 q's per doc)",
      "No podcast",
    ],
    highlight: false,
    cta: "Subscribe",
    ngnOnly: true,
  },
  {
    id: "basic",
    name: "Basic",
    blurb: "A steady semester companion.",
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
    blurb: "Exam season, fully covered.",
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
    blurb: "For the heaviest course loads.",
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
  starter: { price: "—", period: "" },
  basic: { price: "$4.99", period: "/mo" },
  pro: { price: "$9.99", period: "/mo" },
  scholar: { price: "$19.99", period: "/mo" },
};

const testimonials = [
  {
    quote:
      "I usually had a hard time studying and memorizing anything I read, but after I started using Testio everything changed. I turn each chapter into a podcast and listen on my way to school — my last test I scored 82%.",
    name: "Testimony A.",
    role: "300L Microbiology Student",
    initials: "TA",
  },
  {
    quote:
      "Reading PDFs used to put me to sleep. Now I upload my lecture notes, get a podcast in 30 seconds, and revise while I cook. I've never felt this prepared for finals in my life.",
    name: "Bankole O.",
    role: "Final Year Law Student",
    initials: "BO",
  },
  {
    quote:
      "I used to struggle so much with studying and memorizing, especially with the volume of material we cover. Since I started using Testio, everything changed — the notes and quizzes make it actually stick.",
    name: "Damilola A.",
    role: "Medicine & Surgery Student",
    initials: "DA",
  },
  {
    quote:
      "Studying and remembering what I read was always my biggest problem. After I started using Testio everything changed — I revise with podcasts and quizzes and I finally pass with confidence.",
    name: "Gideon E.",
    role: "400L Engineering Student",
    initials: "GE",
  },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Demo" },
  { href: "#pricing", label: "Pricing" },
  { href: "#reviews", label: "Reviews" },
];

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const Stars = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <span className="inline-flex gap-0.5 text-warning" aria-label="5 out of 5 stars">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`${className} fill-current`} />
    ))}
  </span>
);

const SectionHeading = ({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
}) => (
  <Reveal className={align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-xl"}>
    <p className="eyebrow mb-4">{eyebrow}</p>
    <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.08] font-medium text-foreground text-balance">
      {title}
    </h2>
    {body && <p className="mt-4 text-base sm:text-lg text-muted-foreground text-pretty">{body}</p>}
  </Reveal>
);

/** Static product preview used in the hero — a document turning into study tools. */
const HeroPreview = () => {
  const [tab, setTab] = useState<"notes" | "cards" | "quiz">("notes");
  return (
    <div className="relative">
      {/* Document card */}
      <div className="surface rounded-2xl shadow-lifted overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">BIO 201 — The Cell.pdf</p>
              <p className="text-[11px] text-muted-foreground">24 pages · ready in 38s</p>
            </div>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Ready</span>
        </div>

        <div className="px-4 pt-3">
          <div className="inline-flex p-0.5 rounded-lg bg-secondary text-xs">
            {(
              [
                ["notes", "Notes"],
                ["cards", "Flashcards"],
                ["quiz", "Quiz"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`pressable px-3 py-1.5 rounded-md font-medium ${
                  tab === id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 h-[212px]">
          {tab === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-3 text-sm">
              <p className="font-semibold text-foreground">Key ideas</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">—</span> Cells are the smallest unit of life.</li>
                <li className="flex gap-2"><span className="text-primary">—</span> <span><span className="marker text-foreground">Prokaryotes</span> have no nucleus; eukaryotes do.</span></li>
                <li className="flex gap-2"><span className="text-primary">—</span> Mitochondria produce ATP via respiration.</li>
              </ul>
              <div className="space-y-1.5 pt-1">
                <div className="h-2 rounded-full bg-secondary w-full" />
                <div className="h-2 rounded-full bg-secondary w-4/5" />
              </div>
            </motion.div>
          )}
          {tab === "cards" && (
            <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
              <div className="flex-1 rounded-xl border border-border bg-background flex flex-col items-center justify-center text-center p-4">
                <p className="eyebrow mb-2">Card 3 of 24</p>
                <p className="font-display text-lg text-foreground">What is the function of the mitochondria?</p>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                <span>Tap to flip</span>
                <span>12 mastered</span>
              </div>
            </motion.div>
          )}
          {tab === "quiz" && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-2 text-sm">
              <p className="font-medium text-foreground mb-3">Which organelle produces ATP?</p>
              {["Ribosome", "Mitochondria", "Golgi body"].map((o) => (
                <div
                  key={o}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    o === "Mitochondria" ? "border-primary/50 bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {o}
                  {o === "Mitochondria" && <Check className="w-4 h-4 text-primary" />}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating podcast player */}
      <div className="absolute -bottom-8 -left-4 sm:-left-10 w-[250px] surface rounded-2xl shadow-lifted p-3 hidden sm:block">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">Podcast · The Cell</p>
            <div className="flex items-end gap-[3px] h-5 mt-1" aria-hidden>
              {[6, 12, 8, 16, 10, 18, 7, 14, 9, 16, 6, 12, 8, 15, 10, 6].map((h, i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full ${i < 7 ? "bg-primary" : "bg-border"}`}
                  style={{ height: h }}
                />
              ))}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">2:14</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Home = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const { currency, setCurrency, isNigeria, isCurrencyLoading } = useCurrency();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const { scrollYProgress: pageProgress } = useScroll();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visiblePlans = plans.filter((p) => !p.ngnOnly || (currency === "NGN" && isNigeria));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Reading progress */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-primary origin-left z-[60]"
        style={{ scaleX: pageProgress }}
        aria-hidden
      />

      {/* Navbar */}
      <header
        className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
          scrolled ? "bg-background/80 backdrop-blur-lg border-b border-border" : "border-b border-transparent"
        }`}
      >
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/home" className="flex items-center gap-2" aria-label="Testio home">
            <img src={testioLogo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white" />
            <span className="text-lg font-semibold tracking-tight">testio</span>
          </a>

          <div className="hidden md:flex items-center gap-1 text-sm">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              className="pressable w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="pressable hidden sm:inline-flex h-9 px-3.5 items-center rounded-lg text-sm font-medium text-foreground hover:bg-secondary"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="pressable h-9 px-4 inline-flex items-center rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90"
            >
              Get started
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              className="pressable md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </nav>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(-6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1"
          >
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary"
              >
                {l.label}
              </a>
            ))}
            <button onClick={() => navigate("/auth")} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary">
              Log in
            </button>
          </motion.div>
        )}
      </header>

      {/* Hero */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div className="absolute inset-0 dot-grid [mask-image:linear-gradient(to_bottom,black,transparent_85%)] pointer-events-none" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 sm:pt-20 lg:pt-24 lg:pb-32 grid lg:grid-cols-[1.1fr_1fr] gap-14 lg:gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, transform: "translateY(10px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-7"
            >
              <Stars className="w-3 h-3" />
              Loved by 1,000+ students
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, transform: "translateY(14px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
              className="font-display text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem] font-medium tracking-tight text-balance"
            >
              Pass your next exam without reading the whole <span className="marker">textbook.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, transform: "translateY(14px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.12 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl text-pretty"
            >
              Upload any PDF, lecture slide or past question. Testio turns it into notes, flashcards, quizzes and a
              short podcast you can study while walking to class.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, transform: "translateY(14px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.18 }}
              className="mt-9 flex flex-col sm:flex-row gap-3"
            >
              <button onClick={() => navigate("/auth")} className="btn-testio-primary !px-6 !py-3.5 text-base">
                Try free — no card needed <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#demo"
                className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-base font-medium hover:bg-secondary"
              >
                <Play className="w-4 h-4" /> Watch the demo
              </a>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              {["Free forever plan", "Setup in 30 seconds", "Works with PDF, DOCX & images"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-primary" /> {t}
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div style={{ y: previewY }} className="lg:pl-6">
            <motion.div
              initial={{ opacity: 0, transform: "translateY(24px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
            >
              <HeroPreview />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pull quote */}
      <section className="border-y border-border bg-card">
        <Reveal className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
          <p className="font-display text-2xl sm:text-3xl leading-snug text-foreground text-balance">
            “I went from a 2.4 GPA to a 3.7 in one semester. Studying finally feels like a game.”
          </p>
          <p className="mt-5 text-sm text-muted-foreground">Damilola A. · Medicine & Surgery</p>
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            eyebrow="One upload, five ways to learn"
            title={<>Everything you need to study smarter.</>}
            body="Read it, test it, hear it, ask about it. Pick the format that fits the moment."
          />

          <RevealGroup className="mt-16 grid gap-4 md:grid-cols-6">
            <RevealItem className="md:col-span-4">
              <div className="surface rounded-2xl p-6 sm:p-8 h-full flex flex-col sm:flex-row gap-8 hover:border-foreground/20 transition-colors">
                <div className="sm:w-1/2">
                  <FileText className="w-5 h-5 text-primary mb-5" />
                  <h3 className="text-xl font-semibold mb-2">PDF to summary</h3>
                  <p className="text-muted-foreground">
                    Upload a 60-page handout and get the ideas that matter, in plain language, in seconds.
                  </p>
                </div>
                <div className="sm:w-1/2 rounded-xl border border-border bg-background p-4 text-sm space-y-2">
                  <p className="eyebrow">Summary</p>
                  <p className="text-foreground">
                    The <span className="marker">cell theory</span> states that all life is made of cells, cells are
                    the basic unit of life, and cells come from cells.
                  </p>
                  <div className="h-2 rounded-full bg-secondary w-full" />
                  <div className="h-2 rounded-full bg-secondary w-3/4" />
                </div>
              </div>
            </RevealItem>

            <RevealItem className="md:col-span-2">
              <div className="surface rounded-2xl p-6 sm:p-8 h-full hover:border-foreground/20 transition-colors">
                <Layers className="w-5 h-5 text-primary mb-5" />
                <h3 className="text-xl font-semibold mb-2">Flashcards</h3>
                <p className="text-muted-foreground">Auto-built decks for spaced recall. No more copying definitions by hand.</p>
              </div>
            </RevealItem>

            <RevealItem className="md:col-span-2">
              <div className="surface rounded-2xl p-6 sm:p-8 h-full hover:border-foreground/20 transition-colors">
                <ListChecks className="w-5 h-5 text-primary mb-5" />
                <h3 className="text-xl font-semibold mb-2">Practice quizzes</h3>
                <p className="text-muted-foreground">Exam-style questions with instant feedback, so you find gaps before the exam does.</p>
              </div>
            </RevealItem>

            <RevealItem className="md:col-span-2">
              <div className="surface rounded-2xl p-6 sm:p-8 h-full hover:border-foreground/20 transition-colors">
                <Headphones className="w-5 h-5 text-primary mb-5" />
                <h3 className="text-xl font-semibold mb-2">Study podcasts</h3>
                <p className="text-muted-foreground">Two hosts talk through your notes. Revise on the bus, at the gym, while you cook.</p>
              </div>
            </RevealItem>

            <RevealItem className="md:col-span-2">
              <div className="surface rounded-2xl p-6 sm:p-8 h-full hover:border-foreground/20 transition-colors">
                <MessageCircle className="w-5 h-5 text-primary mb-5" />
                <h3 className="text-xl font-semibold mb-2">24/7 AI tutor</h3>
                <p className="text-muted-foreground">Ask anything about your document and get an answer grounded in your own material.</p>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 sm:py-28 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From handout to ready-to-revise in under a minute." />
          <RevealGroup className="mt-16 grid gap-10 md:gap-6 md:grid-cols-3">
            {[
              { icon: Upload, title: "Upload", body: "Drop in a PDF, DOCX, image of your notes, or paste text." },
              { icon: Sparkles, title: "Testio reads it", body: "We pull out key ideas and build your study pack automatically." },
              { icon: Headphones, title: "Study your way", body: "Read notes, flip cards, take a quiz, or press play on the podcast." },
            ].map((s, i) => (
              <RevealItem key={s.title}>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <s.icon className="w-5 h-5 text-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-1.5">{s.title}</h3>
                  <p className="text-muted-foreground">{s.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* See Testio in Action — video kept as-is */}
      <section id="demo" className="scroll-mt-20 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading
            eyebrow="Product walkthrough"
            title="See Testio in action"
            body="Watch a full 7-minute deep dive into how Testio transforms your study materials."
          />
          <Reveal className="mt-12" y={28}>
            <div className="surface rounded-2xl p-2 sm:p-3 shadow-lifted">
              <div className="relative w-full overflow-hidden rounded-xl bg-secondary" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src="https://www.loom.com/embed/8f58c3a8db8c4ec3b6efa8cdd5d52781"
                  title="Testio product walkthrough"
                  frameBorder="0"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          </Reveal>
          <Reveal>
            <SampleDocumentGallery />
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 py-24 sm:py-32 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple, transparent pricing."
            body={
              isCurrencyLoading
                ? "Checking local pricing…"
                : `Choose the plan that fits your study needs. ${currency === "NGN" ? "One-off payment, valid 30 days." : "Cancel anytime."}`
            }
          />

          {isNigeria && !isCurrencyLoading && (
            <Reveal className="flex justify-center mt-8">
              <div className="inline-flex p-1 rounded-xl bg-secondary text-sm">
                {(["NGN", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`pressable px-4 py-2 rounded-lg font-medium ${
                      currency === c ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c === "NGN" ? "Naira (₦) · one-off" : "Dollars ($) · auto-renew"}
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          <RevealGroup
            className={`mt-14 grid gap-4 sm:grid-cols-2 ${visiblePlans.length > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4"} transition-opacity ${
              isCurrencyLoading ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {visiblePlans.map((plan) => {
              const usd = USD_LABELS[plan.id];
              const isNgnPaid = currency === "NGN" && plan.id !== "free";
              const displayPrice = isNgnPaid
                ? formatNgn(NGN_PRICES[plan.id as "starter" | "basic" | "pro" | "scholar"])
                : usd.price;
              const displayPeriod = plan.id === "free" ? usd.period : currency === "NGN" ? "/30 days" : usd.period;
              return (
                <RevealItem key={plan.name} className="h-full">
                  <div
                    className={`relative h-full flex flex-col rounded-2xl p-6 border ${
                      plan.highlight ? "bg-foreground text-background border-foreground" : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {plan.highlight && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-highlight text-highlight-foreground">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-5 ${plan.highlight ? "text-background/70" : "text-muted-foreground"}`}>{plan.blurb}</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-semibold tracking-tight">{displayPrice}</span>
                      {displayPeriod && (
                        <span className={`text-sm ${plan.highlight ? "text-background/60" : "text-muted-foreground"}`}>{displayPeriod}</span>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className={`flex items-start gap-2.5 text-sm ${plan.highlight ? "text-background/85" : "text-foreground/80"}`}>
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? "text-highlight" : "text-primary"}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate("/auth")}
                      className={`pressable w-full py-2.5 rounded-xl font-semibold text-sm ${
                        plan.highlight
                          ? "bg-background text-foreground hover:opacity-90"
                          : "bg-secondary text-foreground hover:bg-accent border border-border"
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="scroll-mt-20 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            eyebrow="Student stories"
            title="Loved by students who used to struggle."
            body="Real stories from students who turned their grades around with Testio."
          />
          <RevealGroup className="mt-16 grid gap-4 sm:grid-cols-2">
            {testimonials.map((t) => (
              <RevealItem key={t.name}>
                <figure className="surface rounded-2xl p-7 h-full flex flex-col">
                  <Stars />
                  <blockquote className="mt-4 text-[17px] leading-relaxed text-foreground flex-1">“{t.quote}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary text-foreground flex items-center justify-center font-semibold text-sm shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Earn free access */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <CreatorRewardsPromo variant="home" className="h-full" />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="surface rounded-2xl p-6 sm:p-8 h-full flex flex-col">
              <p className="eyebrow mb-3 inline-flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" /> Referrals
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-medium mb-3">Invite friends, earn free uploads.</h3>
              <p className="text-muted-foreground mb-6">
                When a friend you invite upgrades to any paid plan (Starter and up), you earn{" "}
                <span className="text-foreground font-medium">+1 bonus upload</span> and a{" "}
                <span className="text-foreground font-medium">streak freeze</span>. No reward until they upgrade — fair
                for everyone.
              </p>
              <ol className="grid gap-3 sm:grid-cols-3 mb-7 text-sm">
                {["Share your referral link", "Friend signs up & upgrades", "You get +1 upload & a freeze"].map((s, i) => (
                  <li key={s} className="rounded-xl border border-border bg-background p-3">
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                    <p className="mt-1 text-foreground">{s}</p>
                  </li>
                ))}
              </ol>
              <button onClick={() => navigate("/auth")} className="btn-testio-primary self-start mt-auto">
                Start referring <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 pb-24">
        <Reveal className="max-w-6xl mx-auto rounded-3xl bg-foreground text-background px-6 py-16 sm:px-12 sm:py-20 text-center overflow-hidden">
          <h2 className="font-display text-3xl sm:text-5xl font-medium leading-[1.05] text-balance max-w-2xl mx-auto">
            Your next exam is closer than it looks.
          </h2>
          <p className="mt-4 text-background/70 text-lg max-w-lg mx-auto">Upload one document free and see the difference tonight.</p>
          <button
            onClick={() => navigate("/auth")}
            className="pressable mt-9 inline-flex items-center gap-2 rounded-xl bg-background text-foreground px-6 py-3.5 font-semibold hover:opacity-90"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </button>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <img src={testioLogo} alt="" className="w-7 h-7 rounded-md object-contain bg-white" />
              <span className="font-semibold">testio</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3 max-w-xs">AI-powered study tools for students.</p>
          </div>
          <div className="text-sm space-y-2.5">
            <p className="eyebrow mb-3">Legal</p>
            <a href="/terms" className="block text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
            <a href="/terms" className="block text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="block text-muted-foreground hover:text-foreground transition-colors">Refund Policy</a>
          </div>
          <div className="text-sm space-y-2.5">
            <p className="eyebrow mb-3">Contact</p>
            <a href="mailto:testio4171@gmail.com" className="block text-muted-foreground hover:text-foreground transition-colors">testio4171@gmail.com</a>
            <a href="tel:+2347062191818" className="block text-muted-foreground hover:text-foreground transition-colors">+234 706 219 1818</a>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© 2026 Testio. All rights reserved.</p>
            <p>
              Created by <span className="font-medium text-foreground/80">TechWorld</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
