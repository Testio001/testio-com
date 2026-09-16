import { useState } from "react";
import { X, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { CreatorTier, CLAIM_RULES, PLATFORMS, PlatformId, validateVideoUrl } from "@/lib/creatorRewards";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const CreatorClaimModal = ({
  tier,
  onClose,
  onSubmitted,
}: {
  tier: CreatorTier;
  onClose: () => void;
  onSubmitted: () => void;
}) => {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<PlatformId>("tiktok");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const urlError = validateVideoUrl(videoUrl, platform);
    if (urlError) {
      toast({ title: "Check your video link", description: urlError, variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Screenshot required", description: "Upload your analytics screenshot showing the view count.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "File too large", description: "Please upload an image under 5MB.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Please sign in again.");

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("creator-screenshots")
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase.rpc("submit_creator_claim" as never, {
        _tier: tier.id,
        _video_url: videoUrl.trim(),
        _platform: platform,
        _screenshot_path: path,
        _notes: notes.trim() || null,
      } as never);
      if (error) throw error;

      const res = data as unknown as { ok?: boolean; message?: string } | null;
      if (res && res.ok === false) {
        toast({ title: "Claim not accepted", description: res.message || "Milestone not met yet.", variant: "destructive" });
        return;
      }

      trackEvent("creator_claim_submitted", { tier: tier.id, platform });
      toast({ title: "Claim submitted 🎉", description: "Our team will verify your views and get back to you." });
      onSubmitted();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit your claim.";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-card border border-border w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-foreground text-lg font-bold">Claim {tier.name} Reward</h2>
            <p className="text-muted-foreground text-xs mt-0.5">{tier.reward}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">Selected tier</label>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground capitalize">
              {tier.name} — {tier.views.toLocaleString()} views + {tier.signups} signups
            </div>
          </div>

          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">Social platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformId)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">Video URL</label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@you/video/..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">Analytics screenshot</label>
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground cursor-pointer hover:border-primary/50">
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">{file ? file.name : "Upload a screenshot showing your view count"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none"
              placeholder="Anything our reviewers should know?"
            />
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-foreground text-xs font-bold flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Before you submit
            </p>
            <ul className="space-y-1">
              {CLAIM_RULES.map((r) => (
                <li key={r} className="text-muted-foreground text-[11px] leading-relaxed">• {r}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-[11px] mt-2 font-semibold">
              Once submitted, your claim is locked — the video link, tier and screenshot can't be changed.
            </p>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatorClaimModal;
