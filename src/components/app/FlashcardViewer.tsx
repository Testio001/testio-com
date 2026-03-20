import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCcw, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type FlashcardSet = Tables<"flashcard_sets">;
type FlashcardCard = Tables<"flashcard_cards">;

const FlashcardViewer = ({ documentId }: { documentId: string }) => {
  const { toast } = useToast();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetchAllCards();
  }, [documentId]);

  const fetchAllCards = async () => {
    const { data: setsData } = await supabase
      .from("flashcard_sets")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });
    if (setsData && setsData.length > 0) {
      setSets(setsData);
      const { data: cardsData } = await supabase
        .from("flashcard_cards")
        .select("*")
        .in("flashcard_set_id", setsData.map(s => s.id))
        .order("order_index");
      if (cardsData) {
        setCards(cardsData);
        setCurrentIndex(0);
        setFlipped(false);
      }
    }
  };

  const generateMore = async () => {
    if (cards.length >= 100) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-flashcards", {
        body: { documentId, count: 15 },
      });
      if (error) throw error;
      toast({ title: "15 more flashcards generated!" });
      await fetchAllCards();
      setCompleted(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (sets.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No flashcards yet. Click "Generate Flashcards" to create them from this document.</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">Loading cards...</div>;
  }

  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;

  const goNext = () => {
    if (isLast) {
      setCompleted(true);
    } else {
      setFlipped(false);
      setCurrentIndex((i) => i + 1);
    }
  };
  const goPrev = () => { setFlipped(false); setCurrentIndex((i) => Math.max(i - 1, 0)); };
  const reset = () => { setFlipped(false); setCurrentIndex(0); setCompleted(false); };

  if (completed) {
    const canGenerateMore = cards.length < 100;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto text-center py-10">
        <h3 className="text-foreground text-xl font-bold mb-2">🎉 You've reviewed all {cards.length} cards!</h3>
        <p className="text-muted-foreground mb-6">Great study session!</p>
        <div className="flex flex-col items-center gap-3">
          <button onClick={reset} className="btn-testio-primary text-sm !py-2 !px-6 inline-flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Start Over
          </button>
          {canGenerateMore && (
            <button
              onClick={generateMore}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate 15 more cards ({cards.length}/100)
            </button>
          )}
          {!canGenerateMore && (
            <p className="text-muted-foreground text-xs">Maximum 100 flashcards reached</p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <span className="text-sm text-muted-foreground">{currentIndex + 1} / {cards.length}</span>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer perspective-1000"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${flipped}`}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`bg-testio-card rounded-2xl p-10 min-h-[280px] flex items-center justify-center text-center ${
              flipped ? "border-primary/30" : ""
            }`}
          >
            <div>
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                {flipped ? "Answer" : "Question"} · Click to flip
              </p>
              <p className="text-foreground text-lg font-medium leading-relaxed">
                {flipped ? card.back : card.front}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <button onClick={goPrev} disabled={currentIndex === 0} className="p-3 rounded-full border border-border text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={reset} className="p-3 rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
          <RotateCcw className="w-5 h-5" />
        </button>
        <button onClick={goNext} className="p-3 rounded-full border border-border text-foreground hover:bg-secondary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardViewer;
