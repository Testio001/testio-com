import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { motion } from "framer-motion";
import { Plus, FileText, Upload, Search, LogOut, Trash2, Settings, UserCircle, Image, Loader2, Gift, Trophy, MoreVertical, Pencil, Share2, HelpCircle, Music, Crown, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import GamificationSidebar from "@/components/app/GamificationSidebar";
import UpgradePrompt from "@/components/app/UpgradePrompt";
import StreakDisplay from "@/components/app/StreakDisplay";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";
import { Badge } from "@/components/ui/badge";
import StudyMusicModal from "@/components/app/StudyMusicModal";

type Document = Tables<"documents">;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const gamification = useGamification();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showReferral, setShowReferral] = useState(false);
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [userPlan, setUserPlan] = useState("free");
  const [showStudyMusic, setShowStudyMusic] = useState(false);

  const sendStudyDeckReadyNotification = async (docTitle: string) => {
    try {
      if (!user) return;
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          payload: {
            title: "📚 Your Study Deck is Ready!",
            body: `The AI has finished summarizing '${docTitle}'. Tap to take your first quiz!`,
            url: "/dashboard"
          }
        }
      });
    } catch {
      // Silent fail - notification is non-critical
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      fetchPlan();
      // Process pending referral — but only if it's not the user's own code
      const pendingRef = localStorage.getItem("testio-referral");
      if (pendingRef) {
        localStorage.removeItem("testio-referral");
        (async () => {
          const statsCheck = await supabase.functions.invoke("manage-gamification", {
            body: { action: "get-stats" },
          });
          const ownCode = statsCheck?.data?.stats?.referral_code;
          if (ownCode && ownCode === pendingRef) {
            toast({ title: "Oops", description: "You can't use your own referral code!", variant: "destructive" });
          } else {
            const result = await gamification.processReferral(pendingRef);
            if (result.success) {
              toast({ title: "🎉 Referral applied!", description: result.message });
            }
          }
        })();
      }
    }
  }, [user]);

  const fetchPlan = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("subscription_plan").eq("user_id", user.id).single();
    if (data?.subscription_plan) setUserPlan(data.subscription_plan);
  };

  const fetchData = async () => {
    const docsRes = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (docsRes.data) setDocuments(docsRes.data);
    setLoading(false);
  };

  const tryUpload = () => {
    if (!gamification.canUpload) {
      setShowReferral(true);
      return;
    }
    setShowUpload(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    setUploading("Uploading document...");
    setShowUpload(false);
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) { setUploading(null); toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); return; }
    setUploading("Creating document...");
    // Classify file type correctly
    const ext = fileExt?.toLowerCase() || "";
    const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    let sourceType = "text";
    if (ext === "pdf") sourceType = "pdf";
    else if (ext === "docx") sourceType = "docx";
    else if (imageExts.includes(ext)) sourceType = "image";
    else if (ext === "doc") {
      setUploading(null);
      toast({ title: "Unsupported format", description: "Legacy .doc files are not supported. Please convert to .docx or PDF first.", variant: "destructive" });
      return;
    }

    const { data: doc, error: docError } = await supabase.from("documents").insert({
      user_id: user.id, title: file.name.replace(`.${fileExt}`, ""), source_type: sourceType, storage_path: filePath, status: "pending",
    }).select().single();
    if (docError) { setUploading(null); toast({ title: "Error", description: docError.message, variant: "destructive" }); return; }
    setUploading("Processing with AI... This may take a moment.");

    fetchData();
    if (doc) {
      try {
        const { error: fnError } = await supabase.functions.invoke("process-document", { body: { documentId: doc.id } });
        if (fnError) throw fnError;
        // Only count upload after successful processing
        gamification.optimisticIncrement();
        const result = await gamification.recordUpload();
        if (result?.bonusEarned) {
          toast({ title: "🎉 Bonus Upload Earned!", description: `${result.newStreak}-day streak! You earned 1 bonus upload.` });
        } else if (result?.isNewDay) {
          toast({ title: `🔥 ${result.newStreak}-day streak!`, description: "Keep uploading daily to earn bonus uploads!" });
        }
        fetchData();
        setUploading(null);
        toast({ title: "Done!", description: "Your document has been processed." });
        // Send push notification that study deck is ready
        sendStudyDeckReadyNotification(doc.title);
      } catch {
        setUploading(null);
        toast({ title: "Processing failed", description: "Couldn't process the document. Please try re-uploading or try again later.", variant: "destructive" });
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        fetchData();
      }
    } else {
      setUploading(null);
    }
  };

  const handleTextUpload = async (text: string, title: string) => {
    if (!user || !text.trim()) return;
    setUploading("Processing text with AI...");
    setShowUpload(false);
    const { data: doc } = await supabase.from("documents").insert({
      user_id: user.id, title: title || "Untitled", source_type: "text", original_content: text, status: "pending",
    }).select().single();

    fetchData();
    if (doc) {
      try {
        const { error: fnError } = await supabase.functions.invoke("process-document", { body: { documentId: doc.id } });
        if (fnError) throw fnError;
        gamification.optimisticIncrement();
        const result = await gamification.recordUpload();
        if (result?.bonusEarned) {
          toast({ title: "🎉 Bonus Upload Earned!", description: `${result.newStreak}-day streak!` });
        }
        fetchData();
        setUploading(null);
        toast({ title: "Done!", description: "Your text has been processed." });
        sendStudyDeckReadyNotification(doc.title);
      } catch {
        setUploading(null);
        toast({ title: "Processing failed", description: "Couldn't process the text. Please try again.", variant: "destructive" });
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        fetchData();
      }
    } else {
      setUploading(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    setUploading("Uploading image...");
    setShowUpload(false);
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) { setUploading(null); toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); return; }
    setUploading("Creating document...");
    const { data: doc, error: docError } = await supabase.from("documents").insert({
      user_id: user.id, title: file.name.replace(`.${fileExt}`, ""), source_type: "image", storage_path: filePath, status: "pending",
    }).select().single();
    if (docError) { setUploading(null); toast({ title: "Error", description: docError.message, variant: "destructive" }); return; }
    setUploading("Extracting text from image with AI... This may take a moment.");

    fetchData();
    if (doc) {
      try {
        const { error: fnError } = await supabase.functions.invoke("process-document", { body: { documentId: doc.id } });
        if (fnError) throw fnError;
        gamification.optimisticIncrement();
        const result = await gamification.recordUpload();
        if (result?.bonusEarned) {
          toast({ title: "🎉 Bonus Upload Earned!", description: `${result.newStreak}-day streak!` });
        }
        fetchData();
        setUploading(null);
        toast({ title: "Done!", description: "Your image has been processed." });
        sendStudyDeckReadyNotification(doc.title);
      } catch {
        setUploading(null);
        toast({ title: "Processing failed", description: "Couldn't process the image. Please try again.", variant: "destructive" });
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        fetchData();
      }
    } else {
      setUploading(null);
    }
  };

  const deleteDocument = async (docId: string) => {
    // Remove from UI immediately
    const deletedDoc = documents.find(d => d.id === docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));

    let undone = false;
    const timeout = setTimeout(async () => {
      if (!undone) {
        await supabase.from("documents").delete().eq("id", docId);
      }
    }, 5000);

    toast({
      title: "Document deleted",
      description: "This action will be permanent in a few seconds.",
      action: (
        <button
          onClick={() => {
            undone = true;
            clearTimeout(timeout);
            if (deletedDoc) setDocuments(prev => [deletedDoc, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            toast({ title: "Restored!", description: "Document has been restored." });
          }}
          className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Undo
        </button>
      ),
    });
  };

  const renameDocument = async (docId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, title: newTitle.trim() } : d));
    await supabase.from("documents").update({ title: newTitle.trim() }).eq("id", docId);
    setRenamingDoc(null);
    toast({ title: "Renamed", description: "Document has been renamed." });
  };

  const shareDocument = (doc: Document) => {
    const text = `Check out my notes on "${doc.title}" on Testio!`;
    const url = gamification.getReferralLink();
    if (navigator.share) {
      navigator.share({ title: doc.title, text, url });
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast({ title: "Link copied!", description: "Share it with your friends." });
    }
  };

  const filteredDocs = documents.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <img src={testioLogo} alt="Testio" className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          <span className="text-foreground font-bold text-base sm:text-lg shrink-0" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
          <Badge variant={userPlan === "pro" ? "default" : userPlan === "basic" ? "secondary" : "outline"} className="text-[9px] sm:text-[10px] uppercase ml-0.5 sm:ml-1 shrink-0">
            {userPlan}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <StreakDisplay stats={gamification.stats} compact />
          <button
            onClick={() => {
              const link = gamification.getReferralLink();
              if (navigator.share) {
                navigator.share({ title: "Join Testio!", text: "Study smarter with AI-powered notes. Use my link to get a bonus upload!", url: link });
              } else {
                navigator.clipboard.writeText(link);
                toast({ title: "Link copied!", description: "Share it with friends to earn uploads." });
              }
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Share referral link"
          >
            <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={() => navigate("/leaderboard")} className="text-muted-foreground hover:text-foreground transition-colors" title="Leaderboard">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={() => navigate("/profile")} className="text-muted-foreground hover:text-foreground transition-colors" title="Profile">
            <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors" title="Watch Tutorial">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>How to use Testio</DialogTitle>
              </DialogHeader>
              <div className="w-full rounded-xl overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src="https://www.loom.com/embed/8f58c3a8db8c4ec3b6efa8cdd5d52781"
                    frameBorder="0"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground transition-colors" title="Settings">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {gamification.canUpload
                    ? `${gamification.uploadsRemaining} upload${gamification.uploadsRemaining > 1 ? "s" : ""} remaining`
                    : "Upload limit reached"}
                </p>
              </div>
              <button onClick={tryUpload} className="btn-testio-primary text-sm flex items-center gap-2 !py-2 !px-4">
                <Plus className="w-4 h-4" /> Upload
              </button>
            </div>

            {uploading && (
              <div className="mb-6 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="text-foreground text-sm font-medium">{uploading}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Please do not close this page.</p>
                </div>
              </div>
            )}

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>

            {showUpload && <UploadModal onClose={() => setShowUpload(false)} onFileUpload={handleFileUpload} onTextUpload={handleTextUpload} onImageUpload={handleImageUpload} />}

            {showReferral && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowReferral(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
                  <UpgradePrompt
                    onUpgrade={() => navigate("/pricing")}
                    onRefer={() => {
                      const link = gamification.getReferralLink();
                      if (navigator.share) {
                        navigator.share({ title: "Join Testio!", text: "Study smarter with AI-powered notes. Use my link to get a bonus upload!", url: link });
                      } else {
                        navigator.clipboard.writeText(link);
                        toast({ title: "Link copied!", description: "Share it with friends to earn uploads." });
                      }
                      setShowReferral(false);
                    }}
                    streakBroken={gamification.stats?.current_streak === 0 && (gamification.stats?.longest_streak || 0) > 0}
                  />
                </motion.div>
              </div>
            )}

            {loading ? (
              <div className="text-center text-muted-foreground py-20">Loading...</div>
            ) : filteredDocs.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                <Upload className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-foreground font-semibold mb-2">No documents yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Upload a PDF, paste text, or upload an image to get started</p>
                <button onClick={tryUpload} className="btn-testio-primary text-sm !py-2 !px-6">Upload Your First Document</button>
              </motion.div>
            ) : (
              <>
                {/* Study Music Feature Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setShowStudyMusic(true)}
                  className="bg-testio-card rounded-xl p-5 cursor-pointer hover:border-primary/30 transition-all group mb-6 border border-border relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Coming Soon</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-semibold text-sm">Study Music</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Turn your notes into catchy songs for memorization</p>
                    </div>
                  </div>
                </motion.div>

                <StudyMusicModal open={showStudyMusic} onOpenChange={setShowStudyMusic} />

                <div className="grid sm:grid-cols-2 gap-4">
                {filteredDocs.map((doc, i) => (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/document/${doc.id}`)} className="bg-testio-card rounded-xl p-5 cursor-pointer hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <FileText className="w-8 h-8 text-primary/60" />
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === "completed" ? "bg-testio-green/20 text-testio-green" : doc.status === "processing" ? "bg-yellow-500/20 text-yellow-400" : doc.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{doc.status}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => { setRenamingDoc(doc.id); setRenameValue(doc.title); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareDocument(doc)}>
                              <Share2 className="w-4 h-4 mr-2" /> Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {renamingDoc === doc.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameDocument(doc.id, renameValue)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameDocument(doc.id, renameValue); if (e.key === "Escape") setRenamingDoc(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-background border border-primary/50 rounded px-2 py-1 text-foreground text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <h3 className="text-foreground font-semibold text-sm mb-1 truncate">{doc.title}</h3>
                    )}
                    <p className="text-muted-foreground text-xs">{doc.source_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}</p>
                  </motion.div>
                ))}
              </div>
              </>
            )}
          </div>

          {/* Gamification sidebar - hidden on mobile, shown on lg+ */}
          <div className="hidden lg:block w-80 shrink-0">
            <GamificationSidebar
              onUpgrade={() => navigate("/pricing")}
              gamification={gamification}
            />
          </div>
        </div>

        {/* Mobile gamification - shown only on mobile */}
        <div className="lg:hidden mt-8">
          <GamificationSidebar
            onUpgrade={() => navigate("/pricing")}
            gamification={gamification}
          />
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ onClose, onFileUpload, onTextUpload, onImageUpload }: { onClose: () => void; onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onTextUpload: (text: string, title: string) => void; onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => {
  const [tab, setTab] = useState<"file" | "text" | "image">("file");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold text-foreground mb-4">Add Content</h2>
        <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-6">
          {(["file", "text", "image"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "file" ? "Upload File" : t === "text" ? "Paste Text" : "Upload Image"}
            </button>
          ))}
        </div>
        {tab === "file" && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Upload className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-3">Upload a PDF, DOCX, or text file</p>
            <label className="btn-testio-primary text-sm !py-2 !px-6 cursor-pointer">Choose File<input type="file" accept=".pdf,.txt,.docx,.md" onChange={onFileUpload} className="hidden" /></label>
          </div>
        )}
        {tab === "text" && (
          <div className="space-y-3">
            <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Paste your text content here..." value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <button onClick={() => onTextUpload(text, title)} disabled={!text.trim()} className="w-full btn-testio-primary text-sm !py-2.5 disabled:opacity-50">Process with AI</button>
          </div>
        )}
        {tab === "image" && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Image className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-3">Upload an image to extract text via AI</p>
            <label className="btn-testio-primary text-sm !py-2 !px-6 cursor-pointer">Choose Image<input type="file" accept="image/*" onChange={onImageUpload} className="hidden" /></label>
          </div>
        )}
        <button onClick={onClose} className="w-full mt-4 text-center text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </motion.div>
    </div>
  );
};

export default Dashboard;
