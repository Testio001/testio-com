import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Edit3, Save, Copy, Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";

type Note = Tables<"notes">;

const NoteViewer = ({ documentId, notes, onRefresh }: { documentId: string; notes: Note[]; onRefresh: () => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copied, setCopied] = useState(false);

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = async (noteId: string) => {
    await supabase.from("notes").update({ content: editContent }).eq("id", noteId);
    setEditingId(null);
    onRefresh();
  };

  const copyNote = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No notes yet. Click "Generate Notes with AI" to create notes from this document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notes.map((note) => (
        <div key={note.id} className="bg-testio-card rounded-xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-foreground font-bold text-xl">{note.title}</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => copyNote(note.content)}
                className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-testio-green" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              {editingId === note.id ? (
                <button onClick={() => saveEdit(note.id)} className="flex items-center gap-1 text-primary text-sm hover:underline">
                  <Save className="w-4 h-4" /> Save
                </button>
              ) : (
                <button onClick={() => startEdit(note)} className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground transition-colors">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}
            </div>
          </div>
          {editingId === note.id ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-4 text-foreground text-sm min-h-[300px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : (
            <div className="note-content prose prose-invert prose-sm max-w-none
              prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3
              prose-h1:text-2xl prose-h1:flex prose-h1:items-center prose-h1:gap-2
              prose-h2:text-xl prose-h2:flex prose-h2:items-center prose-h2:gap-2 prose-h2:border-b prose-h2:border-border/30 prose-h2:pb-2
              prose-h3:text-lg
              prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-4
              prose-strong:text-primary prose-strong:font-semibold
              prose-ul:space-y-1.5 prose-li:text-foreground/85
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-foreground/90
              prose-hr:border-border/30 prose-hr:my-6
              prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            ">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NoteViewer;
