import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ExternalLink, Check, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CREATOR_TIERS } from "@/lib/creatorRewards";

interface AdminClaim {
  id: string;
  user_id: string;
  creator_email: string | null;
  creator_name: string | null;
  tier_requested: string;
  platform: string;
  video_url: string;
  screenshot_path: string | null;
  status: string;
  notes: string | null;
  verified_views: number | null;
  verified_signups: number | null;
  submitted_at: string;
  rejection_reason: string | null;
  reward_expires_at: string | null;
}

const AdminCreatorRewards = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewInputs, setViewInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_creator_claims" as never);
    if (error) {
      toast({ title: "Access denied", description: error.message, variant: "destructive" });
      setClaims([]);
    } else {
      setClaims((data as unknown as AdminClaim[]) ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openScreenshot = async (path: string) => {
    const { data, error } = await supabase.storage.from("creator-screenshots").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open screenshot", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const review = async (claim: AdminClaim, action: "verify" | "approve" | "reject") => {
    setBusyId(claim.id);
    try {
      let verified: number | null = null;
      if (action !== "reject") {
        const raw = viewInputs[claim.id] ?? (claim.verified_views ? String(claim.verified_views) : "");
        if (!raw) throw new Error("Enter the verified view count first.");
        verified = Number(raw);
        if (!Number.isFinite(verified) || verified < 0) throw new Error("Verified views must be a positive number.");
      }
      let reason: string | null = null;
      if (action === "reject") {
        reason = window.prompt("Rejection reason (shown to the creator):") || null;
        if (!reason) { setBusyId(null); return; }
      }

      const { data, error } = await supabase.rpc("admin_review_creator_claim" as never, {
        _claim_id: claim.id,
        _action: action,
        _verified_views: verified,
        _rejection_reason: reason,
      } as never);
      if (error) throw error;
      const res = data as unknown as { ok?: boolean; message?: string } | null;
      if (res && res.ok === false) throw new Error(res.message || "Action refused.");

      toast({ title: `Claim ${action === "verify" ? "views saved" : action + "d"}` });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/admin")} aria-label="Back" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-foreground font-bold">Creator Rewards — Review</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : claims.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-16">No creator claims yet.</p>
        ) : (
          claims.map((c) => {
            const tier = CREATOR_TIERS.find((t) => t.id === c.tier_requested);
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-foreground font-bold text-sm truncate">{c.creator_name || c.creator_email || "Creator"}</p>
                    <p className="text-muted-foreground text-[11px] break-all">{c.creator_email} · {c.user_id}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground">{c.status}</span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-4">
                  <div><p className="text-muted-foreground">Requested tier</p><p className="text-foreground font-semibold capitalize">{c.tier_requested} ({tier?.views.toLocaleString()} views / {tier?.signups} signups)</p></div>
                  <div><p className="text-muted-foreground">Platform</p><p className="text-foreground font-semibold capitalize">{c.platform}</p></div>
                  <div><p className="text-muted-foreground">Verified signups (frozen)</p><p className="text-foreground font-semibold">{c.verified_signups ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Submitted</p><p className="text-foreground font-semibold">{new Date(c.submitted_at).toLocaleString()}</p></div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <a href={c.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground">
                    <ExternalLink className="w-3.5 h-3.5" /> Video
                  </a>
                  {c.screenshot_path && (
                    <button onClick={() => openScreenshot(c.screenshot_path!)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground">
                      <Eye className="w-3.5 h-3.5" /> Screenshot
                    </button>
                  )}
                </div>

                {c.notes && <p className="text-muted-foreground text-xs mb-3">Notes: {c.notes}</p>}
                {c.rejection_reason && <p className="text-destructive text-xs mb-3">Rejected: {c.rejection_reason}</p>}
                {c.reward_expires_at && <p className="text-primary text-xs mb-3">Reward active until {new Date(c.reward_expires_at).toLocaleDateString()}</p>}

                {c.status === "pending" && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Verified views"
                      value={viewInputs[c.id] ?? (c.verified_views ? String(c.verified_views) : "")}
                      onChange={(e) => setViewInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-44"
                    />
                    <button disabled={busyId === c.id} onClick={() => review(c, "verify")} className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-semibold">
                      Save verified views
                    </button>
                    <button disabled={busyId === c.id} onClick={() => review(c, "approve")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" /> Approve & grant 30 days
                    </button>
                    <button disabled={busyId === c.id} onClick={() => review(c, "reject")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

export default AdminCreatorRewards;
