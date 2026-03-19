import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, BookOpen, Brain, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NoteViewer from "@/components/app/NoteViewer";
import FlashcardViewer from "@/components/app/FlashcardViewer";
import QuizViewer from "@/components/app/QuizViewer";
import ChatPanel from "@/components/app/ChatPanel";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";

type Document = Tables<"documents">;
type Note = Tables<"notes">;

const DocumentView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [doc, setDoc] = useState<Document | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "flashcards" | "quiz" | "chat">("notes");
  const [generating, setGenerating] = useState<string | null>(null);
  // Keys to force re-mount of child components after generation
  const [flashcardKey, setFlashcardKey] = useState(0);
  const [quizKey, setQuizKey] = useState(0);

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
      const { data, error } = await supabase.functions.invoke("generate-notes", {
        body: { documentId: id },
      });
      if (error) throw error;
      toast({ title: "Notes generated!" });
      await fetchDocument();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generateFlashcards = async () => {
    if (!id) return;
    setGenerating("flashcards");
    try {
      const { data, error } = await supabase.functions.invoke("generate-flashcards", {
        body: { documentId: id },
      });
      if (error) throw error;
      toast({ title: "Flashcards generated!" });
      // Force re-mount of FlashcardViewer to fetch new data
      setFlashcardKey(prev => prev + 1);
      setActiveTab("flashcards");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generateQuiz = async () => {
    if (!id) return;
    setGenerating("quiz");
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { documentId: id },
      });
      if (error) throw error;
      toast({ title: "Quiz generated!" });
      // Force re-mount of QuizViewer to fetch new data
      setQuizKey(prev => prev + 1);
      setActiveTab("quiz");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-6 max-w-md">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        {activeTab === "notes" && notes.length === 0 && (
          <div className="mb-6">
            <button
              onClick={generateNotes}
              disabled={generating === "notes"}
              className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
            >
              {generating === "notes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Notes with AI
            </button>
          </div>
        )}

        {activeTab === "flashcards" && (
          <div className="mb-6">
            <button
              onClick={generateFlashcards}
              disabled={generating === "flashcards"}
              className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
            >
              {generating === "flashcards" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Generate Flashcards
            </button>
          </div>
        )}

        {activeTab === "quiz" && (
          <div className="mb-6">
            <button
              onClick={generateQuiz}
              disabled={generating === "quiz"}
              className="btn-testio-primary text-sm !py-2 !px-6 flex items-center gap-2"
            >
              {generating === "quiz" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Generate Quiz
            </button>
          </div>
        )}

        {/* Content */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {activeTab === "notes" && <NoteViewer documentId={id!} notes={notes} onRefresh={fetchDocument} />}
          {activeTab === "flashcards" && <FlashcardViewer key={flashcardKey} documentId={id!} />}
          {activeTab === "quiz" && <QuizViewer key={quizKey} documentId={id!} />}
          {activeTab === "chat" && <ChatPanel documentId={id!} />}
        </motion.div>
      </div>
    </div>
  );
};

export default DocumentView;
