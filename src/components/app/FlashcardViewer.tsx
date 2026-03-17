import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type FlashcardSet = Tables<"flashcard_sets">;
type FlashcardCard = Tables<"flashcard_cards">;

const FlashcardViewer = ({ documentId }: { documentId: string }) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [activeSet, setActiveSet] = useState<string | null>(null);

  useEffect(() => {
    fetchSets();
  }, [documentId]);

  useEffect(() => {
    if (activeSet) fetchCards(activeSet);
  }, [activeSet]);

  const fetchSets = async () => {
    const { data } = await supabase
      .from("flashcard_sets")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setSets(data);
      setActiveSet(data[0].id);
    }
  };

  const fetchCards = async (setId: string) => {
    const { data } = await supabase
      .from("flashcard_cards")
      .select("*")
      .eq("flashcard_set_id", setId)
      .order("order_index");
    if (data) {
      setCards(data);
      setCurrentIndex(0);
      setFlipped(false);
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
  const goNext = () => { setFlipped(false); setCurrentIndex((i) => Math.min(i + 1, cards.length - 1)); };
  const goPrev = () => { setFlipped(false); setCurrentIndex((i) => Math.max(i - 1, 0)); };
  const reset = () => { setFlipped(false); setCurrentIndex(0); };

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
            className={`bg-turbo-card rounded-2xl p-10 min-h-[280px] flex items-center justify-center text-center ${
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
        <button onClick={goNext} disabled={currentIndex === cards.length - 1} className="p-3 rounded-full border border-border text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardViewer;
