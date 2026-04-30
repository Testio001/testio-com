import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Edit3, Save, Copy, Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
        <p className="text-muted-foreground">Your notes are being prepared automatically. They will appear here shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {notes.map((note) => (
        <div key={note.id} className="bg-testio-card rounded-3xl p-6 sm:p-10 md:p-14 lg:p-16 shadow-sm border border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 pb-6 border-b border-border/30">
            <h3 className="text-foreground font-bold text-2xl md:text-3xl flex-1 min-w-0 break-words tracking-tight">{note.title}</h3>
            <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-auto">
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
            <div className="note-content prose prose-invert prose-lg md:prose-xl lg:prose-2xl max-w-none w-full
              prose-headings:font-bold prose-headings:text-foreground prose-headings:tracking-tight
              prose-h1:text-4xl md:prose-h1:text-6xl lg:prose-h1:text-7xl prose-h1:flex prose-h1:items-center prose-h1:gap-4 prose-h1:mt-4 prose-h1:mb-10 prose-h1:leading-[1.1]
              prose-h2:text-3xl md:prose-h2:text-4xl lg:prose-h2:text-5xl prose-h2:flex prose-h2:items-center prose-h2:gap-3 prose-h2:mt-16 prose-h2:mb-6 prose-h2:leading-tight
              prose-h3:text-2xl md:prose-h3:text-3xl prose-h3:mt-12 prose-h3:mb-5 prose-h3:flex prose-h3:items-center prose-h3:gap-3
              prose-p:text-foreground prose-p:leading-[1.9] prose-p:mb-7
              prose-strong:text-primary prose-strong:font-semibold
              prose-ul:my-7 prose-ul:space-y-3 prose-li:text-foreground prose-li:leading-[1.85] prose-li:marker:text-primary prose-li:pl-2
              prose-ol:my-7 prose-ol:space-y-3 prose-ol:marker:text-primary
              prose-blockquote:border-l-[6px] prose-blockquote:border-primary prose-blockquote:bg-primary/[0.08] prose-blockquote:py-5 prose-blockquote:px-7 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic prose-blockquote:text-foreground prose-blockquote:my-10 prose-blockquote:text-lg [&_blockquote_p]:before:hidden [&_blockquote_p]:after:hidden [&_blockquote_p]:my-0
              prose-hr:border-border/40 prose-hr:my-14
              prose-code:text-primary prose-code:bg-primary/15 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:before:hidden prose-code:after:hidden prose-code:font-medium
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:text-base md:[&_table]:text-lg [&_table]:my-10 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-border
              [&_thead]:bg-primary/15
              [&_th]:border [&_th]:border-border [&_th]:px-5 [&_th]:py-4 [&_th]:text-left [&_th]:font-bold [&_th]:text-primary [&_th]:align-top
              [&_td]:border [&_td]:border-border [&_td]:px-5 [&_td]:py-4 [&_td]:leading-relaxed [&_td]:text-foreground [&_td]:align-top
              [&_tbody_tr:nth-child(even)]:bg-muted/40
              [&_h1>:first-child:not(a):not(strong):not(em):not(code)]:text-[1.3em] [&_h1>:first-child:not(a):not(strong):not(em):not(code)]:drop-shadow-[0_4px_12px_hsl(var(--primary)/0.5)]
              [&_h2>:first-child:not(a):not(strong):not(em):not(code)]:text-[1.25em] [&_h2>:first-child:not(a):not(strong):not(em):not(code)]:drop-shadow-[0_3px_10px_hsl(var(--primary)/0.45)]
              [&_h3>:first-child:not(a):not(strong):not(em):not(code)]:text-[1.2em] [&_h3>:first-child:not(a):not(strong):not(em):not(code)]:drop-shadow-[0_2px_8px_hsl(var(--primary)/0.4)]
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NoteViewer;
