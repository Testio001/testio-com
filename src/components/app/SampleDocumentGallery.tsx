import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Sigma, Landmark, Eye, X, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Sample = {
  id: string;
  title: string;
  subject: string;
  icon: any;
  color: string;
  summary: string;
  flashcards: { front: string; back: string }[];
  quiz: { q: string; a: string }[];
};

const SAMPLES: Sample[] = [
  {
    id: "biology",
    title: "Biology — Chapter 1: The Cell",
    subject: "Biology",
    icon: BookOpen,
    color: "text-emerald-400 bg-emerald-500/15",
    summary:
      "Cells are the smallest unit of life. All living things are made up of one or more cells. The cell theory states: (1) all life is composed of cells, (2) cells are the basic unit of structure and function, (3) all cells come from pre-existing cells. Prokaryotic cells lack a nucleus, while eukaryotic cells have a defined nucleus and organelles like mitochondria, ER, and Golgi.",
    flashcards: [
      { front: "What is the cell theory?", back: "All living things are made of cells, cells are the basic unit of life, and all cells come from pre-existing cells." },
      { front: "Difference between prokaryotic and eukaryotic cells?", back: "Prokaryotes lack a nucleus and membrane-bound organelles; eukaryotes have both." },
      { front: "Function of mitochondria?", back: "Powerhouse of the cell — produces ATP via cellular respiration." },
    ],
    quiz: [
      { q: "Which organelle is responsible for ATP production?", a: "Mitochondria" },
      { q: "Are bacteria prokaryotic or eukaryotic?", a: "Prokaryotic" },
    ],
  },
  {
    id: "calculus",
    title: "Calculus — Limits & Derivatives",
    subject: "Mathematics",
    icon: Sigma,
    color: "text-blue-400 bg-blue-500/15",
    summary:
      "A limit describes the value a function approaches as the input approaches a point. Derivatives represent the instantaneous rate of change of a function. The power rule states d/dx[xⁿ] = n·xⁿ⁻¹. Common rules include the product rule, quotient rule, and chain rule for composite functions.",
    flashcards: [
      { front: "What is the power rule?", back: "d/dx[xⁿ] = n·xⁿ⁻¹" },
      { front: "Derivative of sin(x)?", back: "cos(x)" },
      { front: "What does a derivative represent geometrically?", back: "The slope of the tangent line at a point on the curve." },
    ],
    quiz: [
      { q: "What is the derivative of x³?", a: "3x²" },
      { q: "What is lim(x→0) sin(x)/x?", a: "1" },
    ],
  },
  {
    id: "history",
    title: "World History — WWII Overview",
    subject: "History",
    icon: Landmark,
    color: "text-amber-400 bg-amber-500/15",
    summary:
      "World War II (1939–1945) was a global conflict between the Allies (USA, UK, USSR, France, China) and the Axis (Germany, Italy, Japan). Triggered by Germany's invasion of Poland in September 1939. Key events: Pearl Harbor (1941), D-Day (1944), Hiroshima & Nagasaki (1945). Resulted in ~70–85 million deaths and reshaped the world order, leading to the Cold War.",
    flashcards: [
      { front: "When did WWII start?", back: "September 1, 1939, with Germany's invasion of Poland." },
      { front: "What was D-Day?", back: "The Allied invasion of Normandy on June 6, 1944." },
      { front: "Which countries formed the Axis powers?", back: "Germany, Italy, and Japan." },
    ],
    quiz: [
      { q: "What event caused the US to enter WWII?", a: "The Japanese attack on Pearl Harbor (Dec 7, 1941)." },
      { q: "Who were the leaders of the 'Big Three' Allied powers?", a: "Roosevelt (USA), Churchill (UK), Stalin (USSR)." },
    ],
  },
];

const SampleDocumentGallery = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<Sample | null>(null);
  const [tab, setTab] = useState<"summary" | "flashcards" | "quiz">("summary");

  return (
    <div className="mt-10">
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-3 py-1 rounded-full mb-2">
          <Sparkles className="w-3 h-3" /> Try without uploading
        </div>
        <h3 className="text-foreground font-bold text-base sm:text-lg">See what you'll get</h3>
        <p className="text-muted-foreground text-xs">Open these sample study packs to preview the magic.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
        {SAMPLES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => { setOpen(s); setTab("summary"); }}
              className="text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{s.subject}</p>
              <h4 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{s.title}</h4>
              <span className="inline-flex items-center gap-1 text-primary text-xs font-medium">
                <Eye className="w-3 h-3" /> Preview
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${open.color}`}>
                    <open.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">{open.subject}</p>
                    <h3 className="text-foreground font-bold text-sm truncate">{open.title}</h3>
                  </div>
                </div>
                <button onClick={() => setOpen(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-1 bg-secondary mx-4 mt-3 rounded-lg p-1">
                {(["summary", "flashcards", "quiz"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors capitalize ${
                      tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto p-4 flex-1">
                {tab === "summary" && (
                  <p className="text-foreground text-sm leading-relaxed">{open.summary}</p>
                )}
                {tab === "flashcards" && (
                  <div className="space-y-2.5">
                    {open.flashcards.map((f, i) => (
                      <div key={i} className="bg-secondary/60 rounded-lg p-3">
                        <p className="text-foreground text-xs font-semibold mb-1">{f.front}</p>
                        <p className="text-muted-foreground text-xs">{f.back}</p>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "quiz" && (
                  <div className="space-y-2.5">
                    {open.quiz.map((q, i) => (
                      <div key={i} className="bg-secondary/60 rounded-lg p-3">
                        <p className="text-foreground text-xs font-semibold mb-1">Q{i + 1}. {q.q}</p>
                        <p className="text-primary text-xs">→ {q.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border bg-secondary/30">
                <p className="text-center text-xs text-muted-foreground mb-3">
                  Generated from a real PDF in 38s ⚡
                </p>
                <button
                  onClick={() => { setOpen(null); navigate("/auth"); }}
                  className="btn-testio-primary w-full text-sm !py-2.5 flex items-center justify-center gap-2"
                >
                  Try with my own document <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SampleDocumentGallery;