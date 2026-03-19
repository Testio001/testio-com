import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Plus, FileText, FolderOpen, Upload, Search, LogOut, MoreVertical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";

type Document = Tables<"documents">;
type Folder = Tables<"folders">;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const [docsRes, foldersRes] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("folders").select("*").order("name"),
    ]);
    if (docsRes.data) setDocuments(docsRes.data);
    if (foldersRes.data) setFolders(foldersRes.data);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    toast({ title: "Uploading...", description: file.name });

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: doc, error: docError } = await supabase.from("documents").insert({
      user_id: user.id,
      title: file.name.replace(`.${fileExt}`, ""),
      source_type: fileExt === "pdf" ? "pdf" : "text",
      storage_path: filePath,
      status: "pending",
    }).select().single();

    if (docError) {
      toast({ title: "Error", description: docError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Uploaded!", description: "Processing document with AI..." });
    setShowUpload(false);
    fetchData();

    if (doc) {
      try {
        await supabase.functions.invoke("process-document", {
          body: { documentId: doc.id },
        });
        fetchData();
      } catch (err) {
        console.error("AI processing error:", err);
      }
    }
  };

  const handleTextUpload = async (text: string, title: string) => {
    if (!user || !text.trim()) return;

    const { data: doc } = await supabase.from("documents").insert({
      user_id: user.id,
      title: title || "Untitled",
      source_type: "text",
      original_content: text,
      status: "pending",
    }).select().single();

    toast({ title: "Created!", description: "Processing with AI..." });
    setShowUpload(false);
    fetchData();

    if (doc) {
      try {
        await supabase.functions.invoke("process-document", {
          body: { documentId: doc.id },
        });
        fetchData();
      } catch (err) {
        console.error("AI processing error:", err);
      }
    }
  };

  const deleteDocument = async (id: string) => {
    await supabase.from("documents").delete().eq("id", id);
    fetchData();
    toast({ title: "Deleted" });
  };

  const createFolder = async () => {
    if (!user) return;
    const name = prompt("Folder name:");
    if (!name) return;
    await supabase.from("folders").insert({ user_id: user.id, name });
    fetchData();
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={testioLogo} alt="Testio" className="w-7 h-7" />
          <span className="text-foreground font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
            <p className="text-muted-foreground text-sm mt-1">Upload content and let AI do the rest</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={createFolder} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors">
              <FolderOpen className="w-4 h-4" />
              New Folder
            </button>
            <button onClick={() => setShowUpload(true)} className="btn-testio-primary text-sm flex items-center gap-2 !py-2 !px-4">
              <Plus className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onFileUpload={handleFileUpload}
            onTextUpload={handleTextUpload}
          />
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading...</div>
        ) : filteredDocs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Upload className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-foreground font-semibold mb-2">No documents yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Upload a PDF, paste text, or add a YouTube link to get started</p>
            <button onClick={() => setShowUpload(true)} className="btn-testio-primary text-sm !py-2 !px-6">
              Upload Your First Document
            </button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/document/${doc.id}`)}
                className="bg-testio-card rounded-xl p-5 cursor-pointer hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <FileText className="w-8 h-8 text-primary/60" />
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      doc.status === "completed" ? "bg-testio-green/20 text-testio-green" :
                      doc.status === "processing" ? "bg-yellow-500/20 text-yellow-400" :
                      doc.status === "failed" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {doc.status}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-foreground font-semibold text-sm mb-1 truncate">{doc.title}</h3>
                <p className="text-muted-foreground text-xs">
                  {doc.source_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const UploadModal = ({
  onClose,
  onFileUpload,
  onTextUpload,
}: {
  onClose: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTextUpload: (text: string, title: string) => void;
}) => {
  const [tab, setTab] = useState<"file" | "text" | "youtube">("file");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">Add Content</h2>

        <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-6">
          {(["file", "text", "youtube"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "file" ? "Upload PDF" : t === "text" ? "Paste Text" : "YouTube URL"}
            </button>
          ))}
        </div>

        {tab === "file" && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Upload className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-3">Drop a PDF or click to browse</p>
            <label className="btn-testio-primary text-sm !py-2 !px-6 cursor-pointer">
              Choose File
              <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={onFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <textarea
              placeholder="Paste your text content here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={() => onTextUpload(text, title)}
              disabled={!text.trim()}
              className="w-full btn-testio-primary text-sm !py-2.5 disabled:opacity-50"
            >
              Process with AI
            </button>
          </div>
        )}

        {tab === "youtube" && (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={() => onTextUpload(youtubeUrl, `YouTube: ${youtubeUrl}`)}
              disabled={!youtubeUrl.trim()}
              className="w-full btn-testio-primary text-sm !py-2.5 disabled:opacity-50"
            >
              Process Video
            </button>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-4 text-center text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </motion.div>
    </div>
  );
};

export default Dashboard;
