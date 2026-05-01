import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, RotateCcw, Plus, Loader2, Sparkles, RefreshCw } from "lucide-react";
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

  // Track which card is in view via horizontal scroll
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
    cardRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  const goNext = () => {
    if (currentIndex < cards.length) scrollToCard(currentIndex + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) scrollToCard(currentIndex - 1);
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
  const isAtEnd = currentIndex >= cards.length;
  const progressPct = Math.min(100, Math.round(((currentIndex + 1) / cards.length) * 100));

  return (
    <div className="relative -mx-4 md:-mx-8">
      {/* Top bar: counter + progress */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-2 pb-3 bg-gradient-to-b from-background/95 to-background/0 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide">
            {Math.min(currentIndex + 1, cards.length)} / {cards.length}
          </span>
          <span className="text-xs text-primary font-medium">{progressPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Horizontal swipe deck */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-260px)] min-h-[440px] overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth no-scrollbar flex"
        style={{ scrollbarWidth: "none", touchAction: "pan-x" }}
      >
        {cards.map((card, idx) => {
          const flipped = !!flippedMap[idx];
          return (
            <div
              key={card.id}
              data-index={idx}
              ref={(el) => (cardRefs.current[idx] = el)}
              className="snap-center shrink-0 w-full h-full flex items-center justify-center px-4 md:px-8 py-4"
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

        {/* End / results summary card */}
        <div
          data-index={cards.length}
          ref={(el) => (cardRefs.current[cards.length] = el)}
          className="snap-center shrink-0 w-full h-full flex items-center justify-center px-4 md:px-8 py-4"
        >
          <div className="w-full max-w-2xl text-center px-6 py-10 rounded-3xl bg-gradient-to-br from-testio-card to-secondary/30 border border-border/60">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-foreground text-3xl font-bold mb-2">All done!</h3>
            <p className="text-muted-foreground mb-6">
              You reviewed all {cards.length} flashcards. Nice work!
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-8">
              <div className="p-4 rounded-2xl bg-background/60 border border-border/50">
                <div className="text-2xl font-bold text-foreground">{cards.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Cards reviewed</div>
              </div>
              <div className="p-4 rounded-2xl bg-background/60 border border-border/50">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-xs text-muted-foreground mt-1">Completion</div>
              </div>
            </div>

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

      {/* Side nav arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={goPrev}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border/60 text-foreground hover:bg-secondary transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {!isAtEnd && (
        <button
          onClick={goNext}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border/60 text-foreground hover:bg-secondary transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Swipe hint */}
      <AnimatePresence>
        {showHint && !isAtEnd && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary/15 border border-primary/30 backdrop-blur text-primary text-xs font-medium">
              <span>Swipe for next</span>
              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating reset (only after first card and before end) */}
      {currentIndex > 0 && !isAtEnd && (
        <button
          onClick={reset}
          className="absolute top-16 right-4 z-20 p-2 rounded-full bg-background/80 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Restart"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default FlashcardViewer;
