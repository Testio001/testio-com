import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, BookOpen, Brain, MessageSquare, Mic, Loader2, Sparkles, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NoteViewer from "@/components/app/NoteViewer";
import FlashcardViewer from "@/components/app/FlashcardViewer";
import QuizViewer from "@/components/app/QuizViewer";
import ChatPanel from "@/components/app/ChatPanel";
import PodcastPlayer from "@/components/app/PodcastPlayer";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";

type Document = Tables<"documents">;
type Note = Tables<"notes">;

const DocumentView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { FREE_PODCAST_MAX_EXCHANGES, FREE_QUIZ_MAX_QUESTIONS } = useGamification();
  const [doc, setDoc] = useState<Document | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "flashcards" | "quiz" | "chat" | "podcast">("notes");
  const [generating, setGenerating] = useState<string | null>(null);
  const [flashcardKey, setFlashcardKey] = useState(0);
  const [quizKey, setQuizKey] = useState(0);
  const [podcastKey, setPodcastKey] = useState(0);

  useEffect(() => {
    if (id && user) fetchDocument();
  }, [id, user]);

  const fetchDocument = async () => {
    const { data: docData } = await supabase.from("documents").select("*").eq("id", id!).single();
    if (docData) setDoc(docData);
    const { data: notesData } = await supabase.from("notes").select("*").eq("document_id", id!).order("created_at");
    if (notesData) setNotes(notesData);
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
      // Free users get max 20 questions
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { documentId: id, count: FREE_QUIZ_MAX_QUESTIONS, maxQuestions: FREE_QUIZ_MAX_QUESTIONS }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Quiz generated!" });
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
    setGenerating("podcast");
    try {
      // Free users get shortened podcast (8 exchanges ~3 mins)
      const { data, error } = await supabase.functions.invoke("generate-podcast", {
        body: { documentId: id, maxExchanges: FREE_PODCAST_MAX_EXCHANGES }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Podcast generated!" });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{doc.title}</h1>
              <p className="text-xs text-muted-foreground">{doc.source_type.toUpperCase()} · {doc.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src={testioLogo} alt="Testio" className="w-8 h-8" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="grid grid-cols-5 bg-secondary rounded-lg p-1 mb-6 max-w-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        {activeTab === "notes" && notes.length === 0 && (
          <div className="mb-6">
            <button onClick={generateNotes} disabled={generating === "notes"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
              {generating === "notes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Notes with AI
            </button>
          </div>
        )}

        {activeTab === "flashcards" && (
          <div className="mb-6">
            <button onClick={generateFlashcards} disabled={generating === "flashcards"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
              {generating === "flashcards" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Generate Flashcards
            </button>
          </div>
        )}

        {activeTab === "quiz" && (
          <div className="mb-6">
            <button onClick={generateQuiz} disabled={generating === "quiz"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
              {generating === "quiz" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Generate Quiz
            </button>
            <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
              <Crown className="w-3 h-3" /> Free plan: up to {FREE_QUIZ_MAX_QUESTIONS} questions per quiz
            </p>
          </div>
        )}

        {activeTab === "podcast" && (
          <div className="mb-6">
            <button onClick={generatePodcast} disabled={generating === "podcast"} className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2">
              {generating === "podcast" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              Generate Podcast
            </button>
            <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
              <Crown className="w-3 h-3" /> Free plan: ~3 minute preview. Upgrade for full-length podcasts.
            </p>
            {generating === "podcast" && (
              <p className="text-muted-foreground text-xs mt-3 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                This may take up to 2-3 minutes. Please do not close this page while the podcast is being generated.
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {activeTab === "notes" && <NoteViewer documentId={id!} notes={notes} onRefresh={fetchDocument} />}
          {activeTab === "flashcards" && <FlashcardViewer key={flashcardKey} documentId={id!} />}
          {activeTab === "quiz" && <QuizViewer key={quizKey} documentId={id!} />}
          {activeTab === "podcast" && <PodcastPlayer key={podcastKey} documentId={id!} />}
          {activeTab === "chat" && <ChatPanel documentId={id!} />}
        </motion.div>
      </div>
    </div>
  );
};

export default DocumentView;
