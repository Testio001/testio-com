import { useState } from "react";
import { Share2, Copy, Check, Mic, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

interface PodcastShareGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralLink: string;
  documentId?: string;
  onUnlocked: () => void;
}

/**
 * Free-tier only gate: the user must share their referral link once before
 * each podcast generation. The friend does NOT need to sign up — completing
 * the share action is enough to unlock this generation.
 */
const PodcastShareGateModal = ({
  isOpen,
  onClose,
  referralLink,
  documentId,
  onUnlocked,
}: PodcastShareGateModalProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const completeShare = async (method: "native_share" | "copy_link") => {
    setBusy(true);
    await trackEvent("referral_share_clicked_for_podcast", {
      method,
      document_id: documentId ?? null,
      plan: "free",
    });
    setBusy(false);
    onUnlocked();
  };

  const handleShare = async () => {
    if (!referralLink) {
      toast({ title: "Referral link not ready", description: "Please try again in a moment." });
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Testio!",
          text: "Study smarter with AI notes, flashcards & podcasts — use my link to get started.",
          url: referralLink,
        });
        await completeShare("native_share");
        return;
      } catch {
        // user dismissed the native sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: "Send it to a friend — podcast unlocked." });
      await completeShare("copy_link");
    } catch {
      toast({ title: "Couldn't copy link", description: "Copy it manually to continue.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Share to unlock your podcast</h2>
          <p className="text-muted-foreground text-sm">
            Share your referral link with a friend to unlock podcast generation. Your friend
            doesn't have to sign up — sharing is enough.
          </p>
        </div>

        {referralLink && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-secondary text-xs text-muted-foreground break-all">
            {referralLink}
          </div>
        )}

        <button
          onClick={handleShare}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copied ? (
            <Check className="w-4 h-4" />
          ) : navigator.share ? (
            <Share2 className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "Link copied — unlocking..." : "Share referral link"}
        </button>

        <p className="text-muted-foreground text-xs text-center mt-3">
          Free plan podcasts are a 1-minute preview. Upgrade for full-length episodes.
        </p>
      </div>
    </div>
  );
};

export default PodcastShareGateModal;
