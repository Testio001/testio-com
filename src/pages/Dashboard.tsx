import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useGamification } from "@/hooks/useGamification";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Upload, Search, LogOut, Trash2, Settings, UserCircle, Image, Gift, Trophy, MoreVertical, Pencil, Share2, HelpCircle, Crown, X, LayoutDashboard, ArrowRight, Gamepad2, Type, Sun, Moon } from "lucide-react";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import GamificationSidebar from "@/components/app/GamificationSidebar";
import PremiumTeaseSidebar from "@/components/app/PremiumTeaseSidebar";
import UpgradePrompt from "@/components/app/UpgradePrompt";
import StreakDisplay from "@/components/app/StreakDisplay";
import type { Tables } from "@/integrations/supabase/types";
import testioLogo from "@/assets/testio-logo.png";
import { Badge } from "@/components/ui/badge";
import RecurringUpsellBanner from "@/components/app/RecurringUpsellBanner";
import CreatorRewardsPromo from "@/components/creator/CreatorRewardsPromo";
import EmptyStateDemo from "@/components/app/EmptyStateDemo";
import InAppTestimonials from "@/components/app/InAppTestimonials";
import ProcessingOverlay from "@/components/app/ProcessingOverlay";
import { useCurrency, priceFor, periodFor, entryPlanFor } from "@/hooks/useCurrency";
import LimitReachedModal from "@/components/app/LimitReachedModal";
import CelebrationScreen from "@/components/app/CelebrationScreen";

type Document = Tables<"documents">;

// Pull the real error message out of a supabase.functions.invoke() failure.
// Non-2xx responses live on err.context (a Response); we read its JSON body
// to surface the edge function's `error` field (e.g. "Document too long...").
async function extractFnErrorMessage(err: any, fallback: string): Promise<string> {
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json().catch(() => null);
      if (body?.error && typeof body.error === "string") return body.error;
    }
    if (typeof err?.message === "string" && err.message && !/edge function/i.test(err.message)) {
      return err.message;
    }
  } catch {}
  return fallback;
}

// Classify upload/processing failures so users see the real cause instead of a
// blanket "document too long" message. Returns a toast title + description.
function classifyProcessingError(
  rawMsg: string,
  err: any,
  kind: "document" | "text" | "image",
): { title: string; description: string } {
  const msg = (rawMsg || "").toLowerCase();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const isNetwork =
    offline ||
    err?.name === "TypeError" ||
    /network|failed to fetch|fetch failed|load failed|timeout|timed out|connection|offline|net::|err_internet|err_network/i.test(
      rawMsg || "",
    );
  const isTooLong = /too long|too large|exceeds|length limit|max(imum)? (length|size|pages?)|page limit/i.test(msg);
  const isServerSide = /ai|openai|model|generation|extract|ocr|parse|server|internal|500|502|503|504|gateway|rate limit/i.test(
    msg,
  );

  if (isNetwork) {
    return {
      title: "Connection problem",
      description:
        "We couldn't reach our servers. Check your internet connection and try again.",
    };
  }
  if (isTooLong) {
    return {
      title: "Document too long",
      description: rawMsg || "Please upload a shorter document and try again.",
    };
  }
  if (isServerSide) {
    return {
      title: "Processing failed on our end",
      description:
        "Our AI couldn't process this " +
        kind +
        " right now. This is on our side — please try again in a moment.",
    };
  }
  return {
    title: "Processing failed",
    description: rawMsg || `Couldn't process the ${kind}. Please try again.`,
  };
}

async function createDocumentUpload(payload: {
  title: string;
  sourceType: "pdf" | "docx" | "text" | "image";
  fileExt?: string;
  originalContent?: string;
}) {
  const { data, error } = await supabase.functions.invoke("create-document-upload", { body: payload });
  if (error) throw error;
  return data as { document: Document; upload: { path: string; token: string } | null };
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const gamification = useGamification();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showReferral, setShowReferral] = useState(false);
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [showPeriodicUpgrade, setShowPeriodicUpgrade] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; seconds: number } | null>(null);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const isAndroidApp = useIsAndroidApp();

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

  useEffect(() => {
    if (!userPlan || userPlan !== "free" || isAndroidApp) return;
    const initialTimer = setTimeout(() => setShowPeriodicUpgrade(true), 3 * 60 * 1000);
    const interval = setInterval(() => setShowPeriodicUpgrade(true), 5 * 60 * 1000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [userPlan, isAndroidApp]);

  // Poll the documents list while any document is still processing/pending so
  // the status chip updates without requiring a manual refresh.
  useEffect(() => {
    const hasInflight = documents.some(
      (d) => d.status === "processing" || d.status === "pending"
    );
    if (!hasInflight) return;
    const interval = setInterval(() => {
      fetchData();
    }, 4000);
    return () => clearInterval(interval);
  }, [documents]);

  const fetchPlan = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("subscription_plan, subscription_expires_at").eq("user_id", user.id).single();
    if (!data) {
      setUserPlan("free");
      return;
    }
    const plan = data.subscription_plan || "free";
    if (plan !== "free" && data.subscription_expires_at) {
      const expiresAt = new Date(data.subscription_expires_at);
      if (expiresAt < new Date()) {
        setUserPlan("free");
        return;
      }
    }
    setUserPlan(plan);
  };

  const fetchData = async () => {
    // Only fetch lightweight columns needed for the list view. `original_content`
    // can be ~50KB/row and is never rendered here — pulling it on every mount
    // was the main Disk I/O hit on Dashboard.
    const docsRes = await supabase
      .from("documents")
      .select("id, user_id, title, status, source_type, source_url, storage_path, folder_id, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (docsRes.data) setDocuments(docsRes.data as any);
    setLoading(false);
  };

  const tryUpload = () => {
    if (gamification.loading) return;
    if (!gamification.canUpload) {
      if (gamification.isAbuseFlagged && (!userPlan || userPlan === "free")) {
        toast({
          title: "Free uploads already used on this device",
          description: `Upgrade to keep generating notes, flashcards, quizzes and podcasts — from ${priceFor(entryPlanFor(currency), currency)}${periodFor(currency)}.`,
          duration: 4000,
        });
        navigate("/pricing");
        return;
      }
      // Free users: show aggressive limit-reached modal with countdown
      if (!userPlan || userPlan === "free") {
        setShowLimitModal(true);
      } else {
        setShowReferral(true);
      }
      return;
    }
    setUploadStartedAt(Date.now());
    setShowUpload(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    // Pre-upload size guard — reject obviously-too-large PDFs before we pay for storage + AI
    if ((fileExt?.toLowerCase() === "pdf") && file.size > 15 * 1024 * 1024) {
      toast({
        title: "Document too long",
        description: "This PDF is too large to process. Please upload a shorter document (under ~15 MB).",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setUploading("Uploading document...");
    setShowUpload(false);
    setUploading("Creating document...");
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

    let doc: Document | null = null;
    try {
      const created = await createDocumentUpload({
        title: file.name.replace(`.${fileExt}`, ""),
        sourceType: sourceType as "pdf" | "docx" | "text" | "image",
        fileExt,
      });
      doc = created.document;
      if (!created.upload) throw new Error("Could not prepare upload");
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(created.upload.path, created.upload.token, file);
      if (uploadError) throw uploadError;
    } catch (err: any) {
      setUploading(null);
      if (doc) await supabase.from("documents").delete().eq("id", doc.id);
      const msg = await extractFnErrorMessage(err, err?.message || "Could not upload this document.");
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
      return;
    }
    setUploading("Processing with AI... This may take a moment.");

    fetchData();
    if (doc) {
      try {
        const { error: fnError } = await supabase.functions.invoke("process-document", { body: { documentId: doc.id } });
        if (fnError) throw fnError;
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
        sendStudyDeckReadyNotification(doc.title);
        // First-document celebration
        const isFirst = !localStorage.getItem("testio_first_doc_celebrated");
        if (isFirst) {
          localStorage.setItem("testio_first_doc_celebrated", "1");
          const secs = uploadStartedAt ? Math.max(8, Math.round((Date.now() - uploadStartedAt) / 1000)) : 38;
          setCelebration({ title: doc.title, seconds: secs });
          setTimeout(() => navigate(`/document/${doc.id}`), 4500);
        } else {
          navigate(`/document/${doc.id}`);
        }
      } catch (err: any) {
        const msg = await extractFnErrorMessage(err, "Couldn't process the document. Please try re-uploading or try again later.");
        setUploading(null);
        const t = classifyProcessingError(msg, err, "document");
        toast({ title: t.title, description: t.description, variant: "destructive" });
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        // Clean up orphaned storage file so we don't pay for unusable uploads
        try { await supabase.storage.from("documents").remove([filePath]); } catch {}
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
        navigate(`/document/${doc.id}`);
      } catch (err: any) {
        const msg = await extractFnErrorMessage(err, "Couldn't process the text. Please try again.");
        setUploading(null);
        const t = classifyProcessingError(msg, err, "text");
        toast({ title: t.title, description: t.description, variant: "destructive" });
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
    setUploading("Uploading image...");
    setShowUpload(false);
    let doc: Document | null = null;
    let filePath = "";
    try {
      const created = await createDocumentUpload({
        title: file.name.replace(`.${fileExt}`, ""),
        sourceType: "image",
        fileExt,
      });
      doc = created.document;
      filePath = doc?.storage_path || "";
      if (!created.upload) throw new Error("Could not prepare upload");
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(created.upload.path, created.upload.token, file);
      if (uploadError) throw uploadError;
    } catch (err: any) {
      setUploading(null);
      if (doc) await supabase.from("documents").delete().eq("id", doc.id);
      const msg = await extractFnErrorMessage(err, err?.message || "Could not upload this image.");
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
      return;
    }
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
        navigate(`/document/${doc.id}`);
      } catch (err: any) {
        const msg = await extractFnErrorMessage(err, "Couldn't process the image. Please try again.");
        setUploading(null);
        const t = classifyProcessingError(msg, err, "image");
        toast({ title: t.title, description: t.description, variant: "destructive" });
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        try { if (filePath) await supabase.storage.from("documents").remove([filePath]); } catch {}
        fetchData();
      }
    } else {
      setUploading(null);
    }
  };

  const deleteDocument = async (docId: string) => {
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

  const bottomNavItems = [
    { icon: LayoutDashboard, label: "Home", action: () => {} },
    { icon: Trophy, label: "Rank", action: () => navigate("/leaderboard") },
    { icon: Plus, label: "Upload", action: tryUpload, primary: true },
    { icon: Gift, label: "Refer", action: () => {
      const link = gamification.getReferralLink();
      if (navigator.share) {
        navigator.share({ title: "Join Testio!", text: "Study smarter with AI-powered notes. Use my link to get a bonus upload!", url: link });
      } else {
        navigator.clipboard.writeText(link);
        toast({ title: "Link copied!", description: "Share it with friends to earn uploads." });
      }
    }},
    { icon: UserCircle, label: "Profile", action: () => navigate("/profile") },
  ];

  const firstName = ((user?.user_metadata as any)?.display_name || (user?.user_metadata as any)?.full_name || "")
    .toString()
    .split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const shareReferral = () => {
    const link = gamification.getReferralLink();
    if (navigator.share) {
      navigator.share({ title: "Join Testio!", text: "Study smarter with AI-powered notes. Use my link to get a bonus upload!", url: link });
    } else {
      navigator.clipboard.writeText(link);
      toast({ title: "Link copied!", description: "Share it with friends to earn uploads." });
    }
  };

  const iconBtn =
    "pressable w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary";

  const sourceIcon = (type: string) => (type === "image" ? Image : FileText);

  const statusStyle: Record<string, { label: string; dot: string; text: string }> = {
    completed: { label: "Ready", dot: "bg-success", text: "text-success" },
    processing: { label: "Processing", dot: "bg-warning animate-pulse", text: "text-warning" },
    pending: { label: "Queued", dot: "bg-muted-foreground", text: "text-muted-foreground" },
    failed: { label: "Failed", dot: "bg-destructive", text: "text-destructive" },
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <ProcessingOverlay
        open={!!uploading}
        title="Processing your document…"
        subtitle={uploading || "This may take a while. We'll open your summary automatically when it's ready."}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={testioLogo} alt="Testio" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white object-contain shrink-0" />
            <span className="text-foreground font-semibold text-base sm:text-lg tracking-tight shrink-0">testio</span>
            {userPlan && (
              <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wider font-medium shrink-0 rounded-md">
                {userPlan}
              </Badge>
            )}
            <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-secondary text-foreground font-medium">Documents</span>
              <button onClick={() => navigate("/leaderboard")} className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Leaderboard
              </button>
              <button onClick={() => navigate("/profile")} className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Profile
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <StreakDisplay stats={gamification.stats} compact />
            <button onClick={shareReferral} className={`${iconBtn} hidden md:flex`} title="Share referral link" aria-label="Share referral link">
              <Gift className="w-[18px] h-[18px]" />
            </button>
            <Dialog>
              <DialogTrigger asChild>
                <button className={`${iconBtn} hidden sm:flex`} title="Watch tutorial" aria-label="Watch tutorial">
                  <HelpCircle className="w-[18px] h-[18px]" />
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
                      title="How to use Testio"
                      frameBorder="0"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={iconBtn}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={() => navigate("/settings")} className={iconBtn} title="Settings" aria-label="Settings">
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <button onClick={signOut} className={iconBtn} title="Sign out" aria-label="Sign out">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-5 mb-8"
            >
              <div>
                <p className="text-sm text-muted-foreground">{greeting}{firstName ? `, ${firstName}` : ""}</p>
                <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-foreground mt-1">Your documents</h1>
                <p className="text-muted-foreground text-sm mt-2">
                  {gamification.loading
                    ? "Checking your uploads…"
                    : gamification.canUpload
                      ? `${gamification.uploadsRemaining} upload${gamification.uploadsRemaining > 1 ? "s" : ""} remaining`
                      : "Upload limit reached"}
                </p>
              </div>
              <button
                onClick={tryUpload}
                disabled={gamification.loading}
                className="w-full sm:w-auto btn-testio-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> {gamification.loading ? "Loading…" : "Upload document"}
              </button>
            </motion.div>

            <div className="relative mb-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search your documents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field pl-10 bg-card"
              />
              {documents.length > 0 && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  {filteredDocs.length}/{documents.length}
                </span>
              )}
            </div>

            {/* Upgrade banner — only shown to free users */}
            {userPlan === "free" && !isAndroidApp && (
              <motion.button
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
                className="pressable w-full text-left mb-4 surface rounded-2xl p-4 sm:p-5 hover:border-primary/40 flex items-center gap-4"
                onClick={() => navigate("/pricing")}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-foreground font-semibold text-sm">Upgrade to unlock everything</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                    More uploads, full podcasts & AI Tutor — from{" "}
                    <span className="text-foreground font-medium">{priceFor(entryPlanFor(currency), currency)}{periodFor(currency)}</span>
                  </p>
                </div>
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  Upgrade <ArrowRight className="w-4 h-4" />
                </span>
              </motion.button>
            )}

            <div className="grid gap-4 sm:grid-cols-2 mb-8">
              {!isAndroidApp && <CreatorRewardsPromo variant="dashboard" />}
              <button
                onClick={() => navigate("/cool-off")}
                className={`pressable w-full flex items-center gap-4 surface rounded-2xl p-4 sm:p-5 text-left hover:border-foreground/20 ${isAndroidApp ? "sm:col-span-2" : ""}`}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-5 h-5 text-foreground" />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm text-foreground">Cool Off Zone</span>
                  <span className="block text-xs sm:text-sm text-muted-foreground mt-0.5">Done reading? Take a quick brain break with Brick Breaker.</span>
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* Periodic upgrade prompt */}
            {showPeriodicUpgrade && userPlan === "free" && !isAndroidApp && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setShowPeriodicUpgrade(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm text-center relative shadow-lifted"
                >
                  <button onClick={() => setShowPeriodicUpgrade(false)} className={`${iconBtn} absolute top-3 right-3`} aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-medium text-foreground mb-2">Unlock the full Testio experience</h3>
                  <p className="text-muted-foreground text-sm mb-4">More uploads, full-length podcasts, unlimited quizzes & flashcards.</p>
                  <p className="text-foreground font-semibold mb-5">
                    {`Starting at ${priceFor(entryPlanFor(currency), currency)}${periodFor(currency)}`}
                  </p>
                  <button
                    onClick={() => { setShowPeriodicUpgrade(false); navigate("/pricing"); }}
                    className="w-full btn-testio-primary mb-2"
                  >
                    Upgrade now
                  </button>
                  <button onClick={() => setShowPeriodicUpgrade(false)} className="w-full py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
                    Continue with free plan
                  </button>
                </motion.div>
              </div>
            )}

            <AnimatePresence>
              {showUpload && <UploadModal onClose={() => setShowUpload(false)} onFileUpload={handleFileUpload} onTextUpload={handleTextUpload} onImageUpload={handleImageUpload} />}
            </AnimatePresence>

            {showReferral && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setShowReferral(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm"
                >
                  <UpgradePrompt
                    onUpgrade={() => navigate("/pricing")}
                    onRefer={() => {
                      shareReferral();
                      setShowReferral(false);
                    }}
                    streakBroken={gamification.stats?.current_streak === 0 && (gamification.stats?.longest_streak || 0) > 0}
                    currentPlan={userPlan || "free"}
                  />
                </motion.div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Library</h2>
              {!loading && documents.length > 0 && (
                <span className="text-xs text-muted-foreground">{documents.length} document{documents.length === 1 ? "" : "s"}</span>
              )}
            </div>

            {loading || gamification.loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" aria-busy>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="surface rounded-2xl p-5 animate-pulse">
                    <div className="w-9 h-9 rounded-lg bg-secondary mb-4" />
                    <div className="h-3.5 w-2/3 rounded bg-secondary mb-2.5" />
                    <div className="h-3 w-1/3 rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              search && documents.length > 0 ? (
                <div className="surface rounded-2xl py-14 text-center">
                  <p className="text-foreground font-medium">No documents match “{search}”</p>
                  <button onClick={() => setSearch("")} className="mt-2 text-sm text-primary hover:underline">Clear search</button>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-border py-14 sm:py-16 px-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-medium text-foreground mb-1.5">Start with one document</h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                    Upload a PDF, paste text, or snap a photo of your notes. We'll turn it into a study pack.
                  </p>
                  <button onClick={tryUpload} className="btn-testio-primary">
                    <Plus className="w-4 h-4" /> Upload your first document
                  </button>
                  <EmptyStateDemo />
                  <div className="max-w-md mx-auto mt-8 text-left">
                    <InAppTestimonials />
                  </div>
                </motion.div>
              )
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {filteredDocs.map((doc, i) => {
                    const Icon = sourceIcon(doc.source_type);
                    const st = statusStyle[doc.status] || statusStyle.pending;
                    const isFailed = doc.status === "failed";
                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, transform: "translateY(10px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: Math.min(i, 10) * 0.04 }}
                        onClick={() => { if (!isFailed) navigate(`/document/${doc.id}`); }}
                        className={`group surface rounded-2xl p-4 sm:p-5 transition-[border-color,box-shadow] duration-200 ${
                          isFailed ? "cursor-default" : "cursor-pointer hover:border-foreground/20 hover:shadow-soft"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                            <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${st.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary" aria-label="Document actions">
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
                            className="field !py-1.5 !px-2 mb-1"
                          />
                        ) : (
                          <h3 className="text-foreground font-medium text-[15px] mb-1 truncate">{doc.title}</h3>
                        )}
                        <p className="text-muted-foreground text-xs">
                          <span className="font-mono uppercase">{doc.source_type}</span> · {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                        {isFailed && (
                          <p className="text-destructive text-xs mt-3 leading-relaxed">
                            Too long or unreadable. Delete it and upload a shorter version.
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-8">
                  <InAppTestimonials />
                </div>
              </>
            )}
          </div>

          {/* Gamification sidebar */}
          <aside className="w-full lg:w-80 shrink-0 space-y-6">
            <GamificationSidebar
              onUpgrade={() => navigate("/pricing")}
              gamification={gamification}
              userPlan={userPlan}
              onUpload={tryUpload}
            />
            <PremiumTeaseSidebar subscriptionPlan={userPlan} />
          </aside>
        </div>

        <p className="text-center text-[11px] text-muted-foreground py-8">
          Created by <span className="font-medium">TechWorld</span>
        </p>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-border safe-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {bottomNavItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className={`pressable flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-xl ${
                item.primary ? "" : item.label === "Home" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.primary ? (
                <span className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary-foreground" />
                </span>
              ) : (
                <>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Recurring "Did you know?" upsell banner — free users only, every ~5 min */}
      <RecurringUpsellBanner userPlan={userPlan} />

      <LimitReachedModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        signupAt={user?.created_at}
        onRefer={() => {
          const link = gamification.getReferralLink();
          if (navigator.share) {
            navigator.share({ title: "Join Testio!", text: "Study smarter with AI-powered notes.", url: link });
          } else {
            navigator.clipboard.writeText(link);
            toast({ title: "Link copied!", description: "Share it with friends to earn uploads." });
          }
        }}
      />

      <CelebrationScreen
        open={!!celebration}
        onClose={() => setCelebration(null)}
        docTitle={celebration?.title || ""}
        elapsedSeconds={celebration?.seconds || 38}
      />
    </div>
  );
};

const UploadModal = ({ onClose, onFileUpload, onTextUpload, onImageUpload }: { onClose: () => void; onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onTextUpload: (text: string, title: string) => void; onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => {
  const [tab, setTab] = useState<"file" | "text" | "image">("file");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs = [
    { id: "file" as const, label: "File", icon: FileText },
    { id: "text" as const, label: "Paste text", icon: Type },
    { id: "image" as const, label: "Image", icon: Image },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ transform: "translateY(24px)", opacity: 0 }}
        animate={{ transform: "translateY(0px)", opacity: 1 }}
        exit={{ transform: "translateY(16px)", opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-lifted safe-bottom"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="upload-title" className="text-lg font-semibold text-foreground">Add content</h2>
            <p className="text-sm text-muted-foreground">We'll build notes, flashcards and a quiz from it.</p>
          </div>
          <button onClick={onClose} className="pressable w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-secondary rounded-xl p-1 mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pressable flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium ${
                tab === t.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        {tab === "file" && (
          <label className="block cursor-pointer text-center py-10 px-4 border border-dashed border-border rounded-2xl bg-background hover:border-primary/50 hover:bg-primary/[0.03] transition-colors">
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-3">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Choose a file</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT or Markdown · up to 15 MB</p>
            <input type="file" accept=".pdf,.txt,.docx,.md" onChange={onFileUpload} className="hidden" />
          </label>
        )}
        {tab === "text" && (
          <div className="space-y-3">
            <input type="text" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
            <textarea placeholder="Paste your lecture notes or any text here…" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="field resize-none" />
            <button onClick={() => onTextUpload(text, title)} disabled={!text.trim()} className="w-full btn-testio-primary disabled:opacity-50">Process with AI</button>
          </div>
        )}
        {tab === "image" && (
          <label className="block cursor-pointer text-center py-10 px-4 border border-dashed border-border rounded-2xl bg-background hover:border-primary/50 hover:bg-primary/[0.03] transition-colors">
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-3">
              <Image className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Choose an image</p>
            <p className="text-xs text-muted-foreground mt-1">A photo of your notes or a slide — we'll read the text</p>
            <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
          </label>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
