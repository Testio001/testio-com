import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, BookOpen, Brain, MessageSquare, Mic, Loader2, Crown, ArrowDown, X, AlertTriangle, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import NoteViewer from "@/components/app/NoteViewer";
import FlashcardViewer from "@/components/app/FlashcardViewer";
import QuizViewer from "@/components/app/QuizViewer";
import ChatPanel from "@/components/app/ChatPanel";
import PodcastPlayer from "@/components/app/PodcastPlayer";
import PodcastLimitModal from "@/components/app/PodcastLimitModal";
import ProcessingOverlay from "@/components/app/ProcessingOverlay";
import UpgradePrompt from "@/components/app/UpgradePrompt";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";

type Document = Tables<"documents">;
type Note = Tables<"notes">;

// Monthly podcast limits per plan (matches Pricing/Home)
const PODCAST_LIMITS: Record<string, number> = {
  free: 1,
  starter: 0, // Starter plan does NOT include podcasts
  basic: 3,
  pro: 6,
  scholar: 9,
};

const DocumentView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { FREE_PODCAST_MAX_EXCHANGES, BASIC_PODCAST_MAX_EXCHANGES, PRO_PODCAST_MAX_EXCHANGES, SCHOLAR_PODCAST_MAX_EXCHANGES, FREE_QUIZ_MAX_QUESTIONS } = useGamification();
  const [doc, setDoc] = useState<Document | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "flashcards" | "quiz" | "chat" | "podcast">("notes");
  const [generating, setGenerating] = useState<string | null>(null);
  const [flashcardKey, setFlashcardKey] = useState(0);
  const [quizKey, setQuizKey] = useState(0);
  const [podcastKey, setPodcastKey] = useState(0);
  const [loadingContent, setLoadingContent] = useState(true);
  const [hasFlashcards, setHasFlashcards] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [hasPodcast, setHasPodcast] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [podcastCount, setPodcastCount] = useState(0);
  const [tourActive, setTourActive] = useState<boolean>(false);
  const [visitedTourTabs, setVisitedTourTabs] = useState<Set<string>>(new Set());
  const [bonusPodcasts, setBonusPodcasts] = useState(0);
  const [showPodcastLimitModal, setShowPodcastLimitModal] = useState(false);
  const [showPodcastPrompt, setShowPodcastPrompt] = useState(false);
  useEffect(() => {
    if (id && user) fetchDocument();
  }, [id, user]);

  // Poll while the document is still processing so the UI updates without a manual refresh.
  useEffect(() => {
    if (!doc || !id) return;
    if (doc.status !== "processing" && doc.status !== "pending") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        setDoc(data);
        if (data.status === "completed" || data.status === "failed") {
          // Refresh related content (notes, flashcards, etc.) once done
          fetchDocument();
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [doc?.status, id]);

  // Tour sequence — the hint points to the NEXT tab in this order from
  // wherever the user currently is. It never switches tabs for them.
  const tourSequence: Array<"notes" | "flashcards" | "quiz" | "podcast" | "chat"> = ["notes", "flashcards", "quiz", "podcast", "chat"];
  const currentIdx = tourSequence.indexOf(activeTab as any);
  const nextTourTab = currentIdx >= 0 && currentIdx < tourSequence.length - 1 ? tourSequence[currentIdx + 1] : null;

  // Activate the tour after the document finishes processing — first time only.
  // Does NOT switch tabs automatically; the hint just appears on whichever
  // feature tab the user is currently viewing.
  useEffect(() => {
    if (!doc || doc.status !== "completed" || loadingContent) return;
    try {
      if (localStorage.getItem("testio_tab_tour_done") === "1") return;
    } catch {}
    setTourActive(true);
  }, [doc?.status, loadingContent]);

  // Track which tabs the user has visited while the tour is active. Once they
  // reach the last tab in the sequence (Chat), finish the tour permanently.
  useEffect(() => {
    if (!tourActive) return;
    if (!(tourSequence as string[]).includes(activeTab)) return;
    setVisitedTourTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
    if (activeTab === tourSequence[tourSequence.length - 1]) {
      try { localStorage.setItem("testio_tab_tour_done", "1"); } catch {}
      setTourActive(false);
    }
  }, [activeTab, tourActive]);

  // First-time podcast prompt: show once after notes are ready and user has no podcast yet
  useEffect(() => {
    if (loadingContent) return;
    if (!doc || doc.status !== "completed") return;
    if (notes.length === 0) return;
    if (hasPodcast) return;
    try {
      if (localStorage.getItem("testio_podcast_prompt_seen") === "1") return;
    } catch {}
    const t = setTimeout(() => setShowPodcastPrompt(true), 1200);
    return () => clearTimeout(t);
  }, [doc?.status, loadingContent, notes.length, hasPodcast]);

  const dismissPodcastPrompt = () => {
    try { localStorage.setItem("testio_podcast_prompt_seen", "1"); } catch {}
    setShowPodcastPrompt(false);
  };

  const triggerPodcastGenerate = () => {
    if (generating === "podcast") return;
    dismissPodcastPrompt();
    setActiveTab("podcast");
    generatePodcast();
  };

  // Focus trap + keyboard support (Esc dismiss, Enter generate) for the podcast prompt
  const podcastPromptRef = useRef<HTMLDivElement | null>(null);
  const podcastPromptCtaRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedBeforePromptRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showPodcastPrompt) return;

    lastFocusedBeforePromptRef.current = (document.activeElement as HTMLElement) ?? null;
    // Focus the primary CTA on open for screen readers / keyboard users
    const focusTimer = window.setTimeout(() => {
      podcastPromptCtaRef.current?.focus();
    }, 50);

    const getFocusable = (): HTMLElement[] => {
      const root = podcastPromptRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("aria-hidden"));
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissPodcastPrompt();
        return;
      }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        // Let Enter on the secondary "Maybe later" / close buttons act normally
        if (target?.tagName === "BUTTON" && target !== podcastPromptCtaRef.current) return;
        e.preventDefault();
        triggerPodcastGenerate();
        return;
      }
      if (e.key === "Tab") {
        const focusables = getFocusable();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!podcastPromptRef.current?.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
      // Restore focus to whatever had it before the prompt opened
      lastFocusedBeforePromptRef.current?.focus?.();
    };
  }, [showPodcastPrompt]);

  const fetchDocument = async () => {
    setLoadingContent(true);
    const { data: docData } = await supabase.from("documents").select("*").eq("id", id!).single();
    if (docData) setDoc(docData);
    const { data: notesData } = await supabase.from("notes").select("*").eq("document_id", id!).order("created_at");
    if (notesData) setNotes(notesData);

    const { count: fcCount } = await supabase.from("flashcard_sets").select("id", { count: "exact", head: true }).eq("document_id", id!);
    setHasFlashcards((fcCount ?? 0) > 0);
    const { count: qCount } = await supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("document_id", id!);
    setHasQuiz((qCount ?? 0) > 0);
    const { count: pCount } = await supabase.from("podcasts").select("id", { count: "exact", head: true }).eq("document_id", id!);
    setHasPodcast((pCount ?? 0) > 0);

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("subscription_plan, subscription_expires_at").eq("user_id", user.id).single();
      if (profile) {
        const isExpired = profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date();
        setSubscriptionPlan(isExpired ? "free" : (profile.subscription_plan || "free"));
      }

      // Count podcast generations from ai_usage_log so that deleting a document
      // (or its podcast) does NOT refund the user's monthly podcast quota.
      // We count usage in the current calendar month to align with monthly limits.
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: totalPodcasts } = await supabase
        .from("ai_usage_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("function_name", "generate-podcast")
        .gte("created_at", monthStart.toISOString());
      setPodcastCount(totalPodcasts ?? 0);

      // Get bonus podcasts from user_stats
      const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
      setBonusPodcasts((stats as any)?.bonus_podcasts ?? 0);
    }

    setLoadingContent(false);
  };

  const getPodcastLimit = () => {
    // Use ?? so Starter's 0 isn't treated as falsy and replaced with a default.
    const baseLimit = PODCAST_LIMITS[subscriptionPlan] ?? 0;
    return baseLimit + bonusPodcasts;
  };

  const canGeneratePodcast = () => {
    return podcastCount < getPodcastLimit();
  };

  const generateNotes = async () => {
    if (!id) return;
    setGenerating("notes");
    try {
      const { data, error } = await supabase.functions.invoke("generate-notes", { body: { documentId: id } });
      if (error) {
        const errorBody = typeof error === 'object' && error.message ? error.message : String(error);
        throw new Error(errorBody);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: "Notes generated!" });
      await fetchDocument();
    } catch (err: any) {
      const msg = err?.message?.includes("non-2xx") 
        ? "We couldn't read the text from this file. Please try re-uploading a clearer PDF or image."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generateFlashcards = async () => {
    if (!id) return;
    setGenerating("flashcards");
    try {
      const { data, error } = await supabase.functions.invoke("generate-flashcards", { body: { documentId: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Flashcards generated!" });
      setHasFlashcards(true);
      setFlashcardKey(prev => prev + 1);
      setActiveTab("flashcards");
    } catch (err: any) {
      const msg = err?.message?.includes("non-2xx")
        ? "We couldn't read the text from this file. Please try re-uploading a clearer PDF or image."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generateQuiz = async () => {
    if (!id) return;
    setGenerating("quiz");
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { documentId: id, count: FREE_QUIZ_MAX_QUESTIONS, maxQuestions: FREE_QUIZ_MAX_QUESTIONS }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Quiz generated!" });
      setHasQuiz(true);
      setQuizKey(prev => prev + 1);
      setActiveTab("quiz");
    } catch (err: any) {
      const msg = err?.message?.includes("non-2xx")
        ? "We couldn't read the text from this file. Please try re-uploading a clearer PDF or image."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generatePodcast = async () => {
    if (!id) return;

    // Starter plan: podcasts are not included — push to upgrade
    if (subscriptionPlan === "starter") {
      toast({
        title: "Podcasts not included on Starter",
        description: "Upgrade to Basic, Pro or Scholar to generate study podcasts.",
        variant: "destructive",
      });
      navigate("/pricing");
      return;
    }

    // Check podcast limit
    if (!canGeneratePodcast()) {
      setShowPodcastLimitModal(true);
      return;
    }

    setGenerating("podcast");
    try {
      const body: any = { documentId: id };
      if (subscriptionPlan === "scholar") {
        body.maxExchanges = SCHOLAR_PODCAST_MAX_EXCHANGES;
      } else if (subscriptionPlan === "pro") {
        body.maxExchanges = PRO_PODCAST_MAX_EXCHANGES;
      } else if (subscriptionPlan === "basic") {
        body.maxExchanges = BASIC_PODCAST_MAX_EXCHANGES;
      } else {
        body.maxExchanges = FREE_PODCAST_MAX_EXCHANGES;
      }
      const { data, error } = await supabase.functions.invoke("generate-podcast", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Podcast generated!" });
      setHasPodcast(true);
      setPodcastCount(prev => prev + 1);
      setPodcastKey(prev => prev + 1);
      setActiveTab("podcast");
    } catch (err: any) {
      const msg = err?.message?.includes("non-2xx")
        ? "Podcast generation failed. Please try again in a moment."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  if (!doc) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  // Failed documents: show a clear failure screen instead of feature tabs so
  // users can't trigger doomed Generate calls on content that was never extracted.
  if (doc.status === "failed") {
    const handleDelete = async () => {
      try {
        if (doc.storage_path) {
          await supabase.storage.from("documents").remove([doc.storage_path]);
        }
        await supabase.from("documents").delete().eq("id", doc.id);
      } catch {}
      navigate("/dashboard");
    };
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/50 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground truncate">{doc.title}</h1>
              <p className="text-xs text-destructive">Failed to process</p>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">We couldn't process this document</h2>
            <p className="text-sm text-muted-foreground mb-6">
              It looks like this file is too long or unreadable. Please upload a shorter version (under ~15 MB / ~50 pages) to generate notes, flashcards, quizzes and podcasts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate("/dashboard")} className="btn-testio-primary text-sm !py-2 !px-5">
                Upload a shorter document
              </button>
              <button onClick={handleDelete} className="inline-flex items-center justify-center gap-2 text-sm px-5 py-2 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition">
                <Trash2 className="w-4 h-4" /> Delete document
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "notes" as const, label: "Notes", icon: FileText },
    { id: "flashcards" as const, label: "Flashcards", icon: BookOpen },
    { id: "quiz" as const, label: "Quiz", icon: Brain },
    { id: "podcast" as const, label: "Podcast", icon: Mic },
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
  ];

  const dismissTour = () => {
    try { localStorage.setItem("testio_tab_tour_done", "1"); } catch {}
    setTourActive(false);
  };

  const podcastLimitTotal = getPodcastLimit();
  const podcastsRemaining = Math.max(0, podcastLimitTotal - podcastCount);

  const generationTitles: Record<string, { title: string; subtitle: string }> = {
    notes: { title: "Generating your notes…", subtitle: "AI is summarising the key points. This usually takes 30–60 seconds." },
    flashcards: { title: "Building flashcards…", subtitle: "Crafting question/answer cards from your notes." },
    quiz: { title: "Creating your quiz…", subtitle: "Designing multiple-choice questions tailored to your content." },
    podcast: { title: "Recording your podcast…", subtitle: "Two AI hosts are recording — this can take 3–5 minutes. Don't close this page." },
  };
  const genInfo = generating ? generationTitles[generating] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Full-screen processing overlay */}
      <ProcessingOverlay
        open={doc.status === "processing" || doc.status === "pending"}
        title="Processing your document…"
        subtitle="This may take a while. Your summary will appear automatically when it's ready."
      />
      <ProcessingOverlay
        open={!!genInfo}
        title={genInfo?.title}
        subtitle={genInfo?.subtitle}
      />

      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{doc.title}</h1>
              <p className="text-xs text-muted-foreground">{doc.source_type.toUpperCase()} · {doc.status === "processing" ? "Processing..." : doc.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src={testioLogo} alt="Testio" className="w-8 h-8" />
          </div>
        </div>
      </header>

      <div className={`${activeTab === "notes" ? "max-w-7xl" : "max-w-6xl"} mx-auto px-4 md:px-8 py-6`}>
        {/* Tabs */}
        <div className="relative grid grid-cols-5 bg-secondary rounded-lg p-1 mb-6 max-w-lg">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative">
              <button
                onClick={() => { setActiveTab(tab.id); }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                } ${tourActive && nextTourTab === tab.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""}`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
              {tourActive && nextTourTab === tab.id && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap pointer-events-auto"
                >
                  <div className="relative bg-primary text-primary-foreground text-[11px] font-medium px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5">
                    {tab.id === "chat" ? "Try chat" : "Tap to generate"}
                    <button onClick={dismissTour} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <ArrowDown className="w-4 h-4 text-primary mx-auto -mt-0.5" />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {!loadingContent && (
          <>
            {activeTab === "flashcards" && !hasFlashcards && (
              <div className="mb-6">
                <button onClick={generateFlashcards} disabled={generating === "flashcards"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
                  {generating === "flashcards" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                  Generate Flashcards
                </button>
              </div>
            )}

            {activeTab === "quiz" && !hasQuiz && (
              <div className="mb-6">
                <button onClick={generateQuiz} disabled={generating === "quiz"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
                  {generating === "quiz" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  Generate Quiz
                </button>
                {subscriptionPlan === "free" && (
                  <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Free plan: up to {FREE_QUIZ_MAX_QUESTIONS} questions per quiz
                  </p>
                )}
              </div>
            )}

            {activeTab === "podcast" && !hasPodcast && (
              <div className="mb-6">
                <button onClick={generatePodcast} disabled={generating === "podcast"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
                  {generating === "podcast" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  Generate Podcast
                </button>
                <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {podcastsRemaining > 0
                    ? `${podcastsRemaining} podcast${podcastsRemaining !== 1 ? "s" : ""} remaining (${podcastCount}/${podcastLimitTotal})`
                    : "Podcast limit reached"
                  }
                  {subscriptionPlan !== "pro" && " · Upgrade for more"}
                </p>
                {generating === "podcast" && (
                  <p className="text-muted-foreground text-xs mt-3 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    This may take up to 3-5 minutes. Please do not close this page while the podcast is being generated.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Content */}
        {loadingContent ? (
          <div className="py-12 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Loading your content...</span>
            </div>
            <Progress value={undefined} className="h-2 w-full max-w-xs animate-pulse" />
          </div>
        ) : (
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {activeTab === "notes" && <NoteViewer documentId={id!} notes={notes} onRefresh={fetchDocument} />}
            {activeTab === "flashcards" && <FlashcardViewer key={flashcardKey} documentId={id!} />}
            {activeTab === "quiz" && <QuizViewer key={quizKey} documentId={id!} />}
            {activeTab === "podcast" && <PodcastPlayer key={podcastKey} documentId={id!} subscriptionPlan={subscriptionPlan} />}
            {activeTab === "chat" && <ChatPanel documentId={id!} subscriptionPlan={subscriptionPlan} />}
          </motion.div>
        )}
      </div>

      <PodcastLimitModal
        isOpen={showPodcastLimitModal}
        onClose={() => setShowPodcastLimitModal(false)}
        subscriptionPlan={subscriptionPlan}
      />
    </div>
  );
};

export default DocumentView;
