import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, RotateCcw, Loader2, Plus, Sparkles, Trophy, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Quiz = Tables<"quizzes">;
type QuizQuestion = Tables<"quiz_questions">;

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

const QuizViewer = ({ documentId }: { documentId: string }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [plan, setPlan] = useState<string>("free");
  // Track per-question answers for review
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    fetchQuizzes();
    fetchPlan();
  }, [documentId]);

  const fetchPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("subscription_plan, subscription_expires_at").eq("user_id", user.id).single();
    if (!data) return;
    const isActive = ["basic", "pro", "scholar"].includes(data.subscription_plan) &&
      data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() > Date.now();
    setPlan(isActive ? data.subscription_plan : "free");
  };

  const isLimitedPlan = plan === "free" || plan === "basic";
  const maxCap = isLimitedPlan ? 20 : 100;

  const fetchQuizzes = async () => {
    // Only show full loader if we have nothing yet; otherwise keep existing
    // content visible and overlay an inline loader.
    setLoading(true);
    try {
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setQuizzes(data);
        await fetchAllQuestions(data.map(q => q.id));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllQuestions = async (quizIds: string[]) => {
    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
      .in("quiz_id", quizIds)
      .order("order_index");
    if (data) {
      setQuestions(data);
      setTotalGenerated(data.length);
    }
  };

  const getOptions = (q: QuizQuestion): QuizOption[] => {
    try {
      const raw = (q.options as any) as QuizOption[];
      return raw.filter(opt => opt && opt.text && opt.text.trim().length > 0);
    } catch {
      return [];
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIndex);
    const options = getOptions(questions[currentIndex]);
    if (options[optionIndex]?.isCorrect) {
      setScore((s) => s + 1);
    }
    setAnswered((a) => a + 1);
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setAnswered(0);
    setShowResult(false);
    setAnswers({});
  };

  const generateMore = async () => {
    // Remember the user's progress so they continue from where they stopped
    const resumeAt = showResult ? questions.length : currentIndex;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-quiz", {
        body: { documentId, count: 20 },
      });
      if (error) throw error;
      toast({ title: "More questions generated!" });
      const { data: newQuizzes } = await supabase
        .from("quizzes")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (newQuizzes) {
        setQuizzes(newQuizzes);
        await fetchAllQuestions(newQuizzes.map(q => q.id));
      }
      setShowResult(false);
      setSelectedAnswer(null);
      // Jump to the next unanswered question (where the user left off)
      setCurrentIndex(resumeAt);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your quiz...</p>
      </div>
    );
  }

  if (!loading && quizzes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No quizzes yet. Click "Generate Quiz" to create one from this document.</p>
      </div>
    );
  }

  if (!loading && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading questions...</p>
      </div>
    );
  }

  // Inline loading overlay shown on top of last-loaded content during refetches
  const LoadingOverlay = () =>
    loading ? (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm rounded-2xl">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your quiz...</p>
      </div>
    ) : null;

  // ========== FULL-SCREEN RESULTS SUMMARY ==========
  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    const incorrect = questions.length - score;
    const canGenerateMore = totalGenerated < maxCap;
    const passed = pct >= 70;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative -mx-4 md:-mx-8 px-4 md:px-8 min-h-[calc(100vh-220px)] flex flex-col"
      >
        <LoadingOverlay />
        {/* Hero score */}
        <div className="w-full max-w-3xl mx-auto text-center pt-6 pb-8">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 14 }}
            className={`inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full mb-5 ${
              passed
                ? "bg-gradient-to-br from-testio-green/20 to-primary/10 border-2 border-testio-green/40"
                : "bg-gradient-to-br from-destructive/20 to-orange-500/10 border-2 border-destructive/40"
            }`}
          >
            <div className={`text-5xl md:text-6xl font-black ${passed ? "text-testio-green" : "text-destructive"}`}>
              {pct}%
            </div>
          </motion.div>
          <h2 className="text-foreground text-3xl md:text-4xl font-bold mb-2 inline-flex items-center gap-2">
            {passed ? <Trophy className="w-7 h-7 text-yellow-400" /> : <Target className="w-7 h-7 text-primary" />}
            {passed ? "Great job!" : "Keep studying!"}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            You got <span className="text-foreground font-semibold">{score}</span> out of{" "}
            <span className="text-foreground font-semibold">{questions.length}</span> correct
          </p>

          {/* Score breakdown */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mt-8">
            <div className="p-4 rounded-2xl bg-testio-card border border-border/60">
              <div className="text-2xl font-bold text-foreground">{questions.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Total</div>
            </div>
            <div className="p-4 rounded-2xl bg-testio-green/10 border border-testio-green/30">
              <div className="text-2xl font-bold text-testio-green">{score}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Correct</div>
            </div>
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
              <div className="text-2xl font-bold text-destructive">{incorrect}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Wrong</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <button onClick={restart} className="btn-testio-primary text-sm !py-2.5 !px-6 inline-flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Restart Quiz
            </button>
            {canGenerateMore && (
              <button
                onClick={generateMore}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate more ({totalGenerated}/{maxCap})
              </button>
            )}
            {!canGenerateMore && isLimitedPlan && (
              <button
                onClick={() => navigate("/pricing")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade for more
              </button>
            )}
          </div>
        </div>

        {/* Per-question review */}
        <div className="w-full max-w-3xl mx-auto pb-12">
          <h3 className="text-foreground text-xl font-bold mb-4 px-1">Review your answers</h3>
          <div className="space-y-4">
            {questions.map((q, qi) => {
              const opts = getOptions(q);
              const userIdx = answers[qi];
              const userOpt = userIdx !== undefined ? opts[userIdx] : null;
              const correctIdx = opts.findIndex(o => o.isCorrect);
              const wasCorrect = userOpt?.isCorrect === true;

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-5 ${
                    wasCorrect
                      ? "border-testio-green/30 bg-testio-green/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wasCorrect ? "bg-testio-green text-background" : "bg-destructive text-destructive-foreground"
                    }`}>
                      {qi + 1}
                    </span>
                    <p className="text-foreground font-medium leading-snug flex-1">{q.question}</p>
                    {wasCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-testio-green shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2 ml-10">
                    {userOpt && !wasCorrect && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className="text-destructive font-medium">{userOpt.text}</span>
                      </div>
                    )}
                    {userIdx === undefined && (
                      <div className="text-sm text-muted-foreground italic">Not answered</div>
                    )}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="text-testio-green font-medium">
                        {correctIdx >= 0 ? opts[correctIdx].text : "—"}
                      </span>
                    </div>
                    {q.explanation && (
                      <div className="mt-2 p-3 rounded-lg bg-background/60 border border-border/50">
                        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">Explanation</p>
                        <p className="text-sm text-foreground/90 leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <button onClick={restart} className="btn-testio-primary text-base !py-3 !px-8 inline-flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Restart Quiz
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const q = questions[currentIndex];
  const options = getOptions(q);

  // Swipe-to-next gesture (only forward, only after answering).
  // Leaves the existing "Next Question" button & explanation untouched.
  const onTouchStart = (e: React.TouchEvent) => {
    if (selectedAnswer === null) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const target = e.target as HTMLElement;
    // Ignore swipes that start on interactive elements (buttons, links, inputs)
    if (target.closest("button, a, input, textarea, select")) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx < 0) {
      // swipe left → next
      nextQuestion();
    }
  };

  return (
    <div
      className="relative -mx-4 md:-mx-8 px-4 md:px-8 min-h-[calc(100vh-220px)] flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <LoadingOverlay />
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">Question {currentIndex + 1} of {questions.length}</span>
        <span className="text-sm text-primary font-medium">Score: {score}/{answered}</span>
      </div>

      <div className="w-full h-1.5 bg-secondary rounded-full mb-8">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 flex flex-col w-full max-w-3xl mx-auto"
      >
        <h3 className="text-foreground text-2xl md:text-3xl font-semibold mb-8 leading-snug">{q.question}</h3>

        <div className="space-y-3">
          {options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrect = option.isCorrect;
            const showFeedback = selectedAnswer !== null;

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left p-5 md:p-6 rounded-2xl border transition-all ${
                  showFeedback && isCorrect
                    ? "border-testio-green bg-testio-green/10"
                    : showFeedback && isSelected && !isCorrect
                    ? "border-destructive bg-destructive/10"
                    : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30 bg-testio-card"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-semibold text-foreground">{String.fromCharCode(65 + i)}</span>
                  <span className="text-foreground text-base md:text-lg flex-1 leading-relaxed">{option.text}</span>
                  {showFeedback && isCorrect && <CheckCircle2 className="w-6 h-6 text-testio-green shrink-0" />}
                  {showFeedback && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-destructive shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && q.explanation && (
          <div className="mt-6 p-5 bg-secondary rounded-2xl border border-border/50">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">Explanation</p>
            <p className="text-sm md:text-base text-foreground/90 leading-relaxed">{q.explanation}</p>
          </div>
        )}

        {selectedAnswer !== null && (
          <div className="mt-8 flex justify-end">
            <button onClick={nextQuestion} className="btn-testio-primary text-base !py-3 !px-8">
              {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default QuizViewer;
