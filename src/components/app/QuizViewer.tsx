import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, RotateCcw, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables, Json } from "@/integrations/supabase/types";

type Quiz = Tables<"quizzes">;
type QuizQuestion = Tables<"quiz_questions">;

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

const QuizViewer = ({ documentId }: { documentId: string }) => {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [totalGenerated, setTotalGenerated] = useState(0);

  useEffect(() => {
    fetchQuizzes();
  }, [documentId]);

  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setQuizzes(data);
      fetchAllQuestions(data.map(q => q.id));
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
      // Filter out options with empty/missing text
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
  };

  const generateMore = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { documentId, count: 15 },
      });
      if (error) throw error;
      toast({ title: "15 more questions generated!" });
      // Re-fetch all questions
      const allQuizIds = quizzes.map(q => q.id);
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
      // Continue from where user left off
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No quizzes yet. Click "Generate Quiz" to create one from this document.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">Loading questions...</div>;
  }

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    const canGenerateMore = totalGenerated < 100;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto text-center py-10">
        <div className={`text-6xl font-black mb-4 ${pct >= 70 ? "text-testio-green" : "text-destructive"}`}>
          {pct}%
        </div>
        <h3 className="text-foreground text-xl font-bold mb-2">
          {pct >= 70 ? "Great job!" : "Keep studying!"}
        </h3>
        <p className="text-muted-foreground mb-6">
          You got {score} out of {questions.length} correct
        </p>
        <div className="flex flex-col items-center gap-3">
          <button onClick={restart} className="btn-testio-primary text-sm !py-2 !px-6 inline-flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          {canGenerateMore && (
            <button
              onClick={generateMore}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate 15 more questions ({totalGenerated}/100)
            </button>
          )}
          {!canGenerateMore && (
            <p className="text-muted-foreground text-xs">Maximum 100 questions reached</p>
          )}
        </div>
      </motion.div>
    );
  }

  const q = questions[currentIndex];
  const options = getOptions(q);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-muted-foreground">Question {currentIndex + 1} of {questions.length}</span>
        <span className="text-sm text-primary font-medium">Score: {score}/{answered}</span>
      </div>

      <div className="w-full h-1.5 bg-secondary rounded-full mb-8">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <h3 className="text-foreground text-lg font-semibold mb-6">{q.question}</h3>

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
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  showFeedback && isCorrect
                    ? "border-testio-green bg-testio-green/10"
                    : showFeedback && isSelected && !isCorrect
                    ? "border-destructive bg-destructive/10"
                    : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30 bg-testio-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-mono w-6">{String.fromCharCode(65 + i)}.</span>
                  <span className="text-foreground text-sm flex-1">{option.text}</span>
                  {showFeedback && isCorrect && <CheckCircle2 className="w-5 h-5 text-testio-green" />}
                  {showFeedback && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive" />}
                </div>
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && q.explanation && (
          <div className="mt-4 p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">{q.explanation}</p>
          </div>
        )}

        {selectedAnswer !== null && (
          <button onClick={nextQuestion} className="btn-testio-primary text-sm !py-2 !px-6 mt-6">
            {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default QuizViewer;
