import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, BookOpen, Brain, MessageSquare, Mic, Loader2, Sparkles, Crown, ArrowDown, X } from "lucide-react";
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
  const [tourStep, setTourStep] = useState<number>(-1); // -1 = inactive, 0..3 cycles through tabs
  const [bonusPodcasts, setBonusPodcasts] = useState(0);
  const [showPodcastLimitModal, setShowPodcastLimitModal] = useState(false);

  useEffect(() => {
    if (id && user) fetchDocument();
  }, [id, user]);

  // Tour tabs (excluding Chat) — show "Tap to generate" once per user lifetime
  const tourTabs: Array<"notes" | "flashcards" | "quiz" | "podcast"> = ["notes", "flashcards", "quiz", "podcast"];

  // Start the tour after the document finishes processing — first time only.
  useEffect(() => {
    if (!doc || doc.status !== "completed" || loadingContent) return;
    try {
      if (localStorage.getItem("testio_tab_tour_done") === "1") return;
    } catch {}
    if (tourStep === -1) setTourStep(0);
  }, [doc?.status, loadingContent]);

  // Advance tour automatically every 2.8s
  useEffect(() => {
    if (tourStep < 0) return;
    if (tourStep >= tourTabs.length) {
      try { localStorage.setItem("testio_tab_tour_done", "1"); } catch {}
      setTourStep(-1);
      return;
    }
    setActiveTab(tourTabs[tourStep]);
    const t = setTimeout(() => setTourStep((s) => s + 1), 2800);
    return () => clearTimeout(t);
  }, [tourStep]);

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

      // Get total podcast count for user
      const { count: totalPodcasts } = await supabase.from("podcasts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setPodcastCount(totalPodcasts ?? 0);

      // Get bonus podcasts from user_stats
      const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
      setBonusPodcasts((stats as any)?.bonus_podcasts ?? 0);
    }

    setLoadingContent(false);
  };

  const getPodcastLimit = () => {
    const baseLimit = PODCAST_LIMITS[subscriptionPlan] || 2;
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

  const tabs = [
    { id: "notes" as const, label: "Notes", icon: FileText },
    { id: "flashcards" as const, label: "Flashcards", icon: BookOpen },
    { id: "quiz" as const, label: "Quiz", icon: Brain },
    { id: "podcast" as const, label: "Podcast", icon: Mic },
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
  ];

  const dismissTour = () => {
    try { localStorage.setItem("testio_tab_tour_done", "1"); } catch {}
    setTourStep(-1);
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
      {/* Big half-screen processing overlay */}
      <ProcessingOverlay
        open={doc.status === "processing"}
        title="Processing your document…"
        subtitle="We're extracting and analysing your content. This usually takes 10–30 seconds."
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

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="relative grid grid-cols-5 bg-secondary rounded-lg p-1 mb-6 max-w-lg">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative">
              <button
                onClick={() => { setActiveTab(tab.id); if (tourStep >= 0) dismissTour(); }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                } ${tourStep >= 0 && tourTabs[tourStep] === tab.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""}`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
              {tourStep >= 0 && tourTabs[tourStep] === tab.id && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap pointer-events-auto"
                >
                  <div className="relative bg-primary text-primary-foreground text-[11px] font-medium px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5">
                    Tap to generate
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
        {!loadingContent && activeTab === "notes" && notes.length === 0 && (
          <div className="mb-6">
            <button onClick={generateNotes} disabled={generating === "notes"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
              {generating === "notes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Notes with AI
            </button>
          </div>
        )}

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
            {activeTab === "podcast" && <PodcastPlayer key={podcastKey} documentId={id!} />}
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
