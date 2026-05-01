import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, RotateCcw, Plus, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type FlashcardSet = Tables<"flashcard_sets">;
type FlashcardCard = Tables<"flashcard_cards">;

const FlashcardViewer = ({ documentId }: { documentId: string }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedMap, setFlippedMap] = useState<Record<number, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetchAllCards();
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
        setFlippedMap({});
      }
    }
  };

  const isLimitedPlan = plan === "free" || plan === "basic";
  const maxCap = isLimitedPlan ? 20 : 100;

  const generateMore = async () => {
    if (cards.length >= maxCap) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-flashcards", {
        body: { documentId, count: 20 },
      });
      if (error) throw error;
      toast({ title: "More flashcards generated!" });
      await fetchAllCards();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Track which card is in view via scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setCurrentIndex(idx);
              if (idx > 0) setShowHint(false);
            }
          }
        });
      },
      { root: container, threshold: [0.6] }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [cards.length]);

  const toggleFlip = (idx: number) => {
    setFlippedMap((m) => ({ ...m, [idx]: !m[idx] }));
  };

  const scrollToCard = (idx: number) => {
    cardRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reset = () => {
    setFlippedMap({});
    scrollToCard(0);
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

  const canGenerateMore = cards.length < maxCap;
  const isAtEnd = currentIndex === cards.length - 1;

  return (
    <div className="relative -mx-4 md:-mx-8">
      {/* Top counter pill */}
      <div className="sticky top-0 z-20 flex justify-center pointer-events-none pt-2 pb-3">
        <div className="pointer-events-auto px-4 py-1.5 rounded-full bg-background/80 backdrop-blur border border-border/50 text-xs font-medium text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      {/* Snap-scroll deck — fills the tab area */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-220px)] min-h-[480px] overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar px-4 md:px-8"
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((card, idx) => {
          const flipped = !!flippedMap[idx];
          return (
            <div
              key={card.id}
              data-index={idx}
              ref={(el) => (cardRefs.current[idx] = el)}
              className="snap-start h-full flex items-center justify-center py-4"
            >
              <button
                type="button"
                onClick={() => toggleFlip(idx)}
                className="group relative w-full max-w-3xl h-full max-h-[640px] rounded-3xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ perspective: "1500px" }}
                aria-label="Flip card"
              >
                <motion.div
                  className="relative w-full h-full"
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 18 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Front (Question) */}
                  <div
                    className="absolute inset-0 rounded-3xl bg-gradient-to-br from-testio-card via-testio-card to-secondary/40 border border-border/60 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.25)] flex flex-col items-center justify-center p-8 md:p-14 text-center"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <span className="text-[11px] tracking-[0.25em] font-semibold text-primary/80 uppercase mb-6">
                      Question · Tap to flip
                    </span>
                    <p className="text-foreground text-2xl md:text-4xl font-semibold leading-snug">
                      {card.front}
                    </p>
                    <span className="absolute bottom-5 right-6 text-[11px] text-muted-foreground/60 font-mono">
                      {idx + 1}
                    </span>
                  </div>
                  {/* Back (Answer) */}
                  <div
                    className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 via-testio-card to-primary/5 border border-primary/30 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.45)] flex flex-col items-center justify-center p-8 md:p-14 text-center"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <span className="text-[11px] tracking-[0.25em] font-semibold text-primary uppercase mb-6">
                      Answer · Tap to flip back
                    </span>
                    <p className="text-foreground text-xl md:text-3xl font-medium leading-relaxed">
                      {card.back}
                    </p>
                  </div>
                </motion.div>
              </button>
            </div>
          );
        })}

        {/* End card */}
        <div className="snap-start h-full flex items-center justify-center py-4">
          <div className="w-full max-w-2xl text-center px-6">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-foreground text-2xl font-bold mb-2">All {cards.length} cards reviewed!</h3>
            <p className="text-muted-foreground mb-8">Great study session.</p>
            <div className="flex flex-col items-center gap-3">
              <button onClick={reset} className="btn-testio-primary text-sm !py-2.5 !px-6 inline-flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Start Over
              </button>
              {canGenerateMore && (
                <button
                  onClick={generateMore}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Generate 20 more cards ({cards.length}/{maxCap})
                </button>
              )}
              {!canGenerateMore && isLimitedPlan && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {cards.length}/{maxCap} — Upgrade for more
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll-down hint */}
      <AnimatePresence>
        {showHint && !isAtEnd && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-full bg-primary/15 border border-primary/30 backdrop-blur">
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="flex items-center gap-1.5 text-primary text-xs font-medium"
              >
                <span>Scroll for next</span>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating reset (only after first card) */}
      {currentIndex > 0 && !isAtEnd && (
        <button
          onClick={reset}
          className="absolute top-3 right-4 z-20 p-2 rounded-full bg-background/80 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Restart"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default FlashcardViewer;
