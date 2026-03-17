import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Edit3, Save } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";

type Note = Tables<"notes">;

const NoteViewer = ({ documentId, notes, onRefresh }: { documentId: string; notes: Note[]; onRefresh: () => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = async (noteId: string) => {
    await supabase.from("notes").update({ content: editContent }).eq("id", noteId);
    setEditingId(null);
    onRefresh();
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
        <div key={note.id} className="bg-turbo-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground font-bold text-lg">{note.title}</h3>
            {editingId === note.id ? (
              <button onClick={() => saveEdit(note.id)} className="flex items-center gap-1 text-primary text-sm hover:underline">
                <Save className="w-4 h-4" /> Save
              </button>
            ) : (
              <button onClick={() => startEdit(note)} className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
          {editingId === note.id ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-4 text-foreground text-sm min-h-[300px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NoteViewer;
