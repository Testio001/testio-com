import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Edit3, Save, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Note = Tables<"notes">;

const NoteViewer = ({ documentId, notes, onRefresh }: { documentId: string; notes: Note[]; onRefresh: () => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  const regenerateNote = async (noteId: string) => {
    if (regenerating) return;
    const ok = window.confirm("Rebuild these notes with the latest premium formatting? Your current version will be replaced.");
    if (!ok) return;
    setRegenerating(true);
    try {
      const { error: delErr } = await supabase.from("notes").delete().eq("id", noteId);
      if (delErr) throw delErr;
      const { error: fnErr } = await supabase.functions.invoke("generate-notes", { body: { documentId } });
      if (fnErr) throw fnErr;
      toast.success("Notes rebuilt with new formatting");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not regenerate notes");
    } finally {
      setRegenerating(false);
    }
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Your notes are being prepared automatically. They will appear here shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notes.map((note) => (
        <div key={note.id} className="bg-testio-card rounded-2xl p-5 sm:p-8 md:p-10 lg:p-12 shadow-sm border border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-border/30">
            <h3 className="text-foreground font-bold text-xl md:text-2xl flex-1 min-w-0 break-words">{note.title}</h3>
            <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-auto">
              <button
                onClick={() => regenerateNote(note.id)}
                disabled={regenerating}
                className="flex items-center gap-1 text-muted-foreground text-sm hover:text-primary transition-colors disabled:opacity-50"
                title="Rebuild with latest formatting"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Rebuilding…" : "Rebuild"}
              </button>
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
            <div className="note-content prose prose-invert prose-base md:prose-lg lg:prose-xl max-w-none w-full
              prose-headings:font-bold prose-headings:text-foreground prose-headings:tracking-tight
              prose-h1:text-3xl md:prose-h1:text-4xl lg:prose-h1:text-5xl prose-h1:flex prose-h1:items-center prose-h1:gap-3 prose-h1:mt-2 prose-h1:mb-6 prose-h1:leading-tight
              prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:flex prose-h2:items-center prose-h2:gap-3 prose-h2:mt-10 prose-h2:mb-4 prose-h2:leading-tight
              prose-h3:text-xl md:prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-foreground/90 prose-p:leading-[1.8] prose-p:mb-5
              prose-strong:text-primary prose-strong:font-semibold
              prose-ul:my-5 prose-ul:space-y-2 prose-li:text-foreground/85 prose-li:leading-relaxed prose-li:marker:text-primary
              prose-ol:my-5 prose-ol:space-y-2 prose-ol:marker:text-primary
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/[0.06] prose-blockquote:py-4 prose-blockquote:px-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-foreground/90 prose-blockquote:my-6 [&_blockquote_p]:before:hidden [&_blockquote_p]:after:hidden [&_blockquote_p]:my-0
              prose-hr:border-border/30 prose-hr:my-8
              prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:hidden prose-code:after:hidden prose-code:font-medium
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:text-sm md:[&_table]:text-base [&_table]:my-6 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border
              [&_thead]:bg-primary/10
              [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-bold [&_th]:text-primary [&_th]:align-top
              [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:leading-relaxed [&_td]:text-foreground/85 [&_td]:align-top
              [&_tbody_tr:nth-child(even)]:bg-muted/30
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
