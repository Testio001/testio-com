import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Video, Link2, Target, Send, Copy, Check, Share2, Loader2, ShieldCheck, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import CreatorTierCard from "@/components/creator/CreatorTierCard";
import CreatorClaimModal from "@/components/creator/CreatorClaimModal";
import { CREATOR_TIERS, CreatorTier, UGC_RULES, highestEligibleTier, nextTier } from "@/lib/creatorRewards";

interface CreatorDashboard {
  creator_code: string | null;
  verified_views: number;
  verified_signups: number;
  views_pending: boolean;
  campaign_status: string | null;
  reward_plan: string | null;
  reward_expiration_date: string | null;
  claim: null | {
    id: string;
    tier_requested: string;
    status: string;
    platform: string;
    video_url: string;
    verified_views: number | null;
    rejection_reason: string | null;
    submitted_at: string | null;
  };
}

const STEPS = [
  { icon: Video, title: "Create & Post", body: "Make a short video about Testio — studying, AI podcasts, exam prep, flashcards, productivity, or your own creative idea." },
  { icon: Link2, title: "Add Your Link", body: "Put your unique creator link in your bio or caption so we can track the students you bring in." },
  { icon: Target, title: "Hit Your Milestone", body: "Reach the verified views and legitimate new signups for your tier." },
  { icon: Send, title: "Submit & Unlock", body: "Submit your video link and analytics screenshot. We verify it and unlock your free plan." },
];

const CreatorRewards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [claimTier, setClaimTier] = useState<CreatorTier | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.rpc("get_creator_dashboard" as never);
    if (!error && res) setData(res as unknown as CreatorDashboard);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    trackEvent("creator_rewards_viewed", { source: "page" });
    load();
  }, [load]);

  const link = data?.creator_code ? `https://testio.online/?ref=${data.creator_code}` : "";
  const views = data?.verified_views ?? 0;
  const signups = data?.verified_signups ?? 0;
  const eligible = highestEligibleTier(views, signups);
  const target = nextTier(views, signups);
  const locked = !!data?.claim && ["pending", "under_review"].includes(data.claim.status);

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    trackEvent("creator_link_copied", {});
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    const text = `I turn my lecture notes into AI podcasts, flashcards and quizzes with Testio. Try it free: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Testio", text, url: link });
        trackEvent("creator_link_copied", { via: "native_share" });
        return;
      } catch { /* user cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const startClaim = (tier: CreatorTier) => {
    trackEvent("creator_claim_started", { tier: tier.id });
    setClaimTier(tier);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border px-4 sm:px-6 py-4 sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-foreground font-bold">Creator Rewards</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-10 pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold mb-5">
            <Video className="w-3.5 h-3.5" /> UGC Creator Program
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight mb-4">
            Turn Your Content Into Free Testio Access
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-7">
            Create a video about Testio, bring real users to the platform, and unlock up to 30 days of Pro for free.
          </p>
          <button
            onClick={() => document.getElementById("creator-tracker")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold hover:opacity-90"
          >
            Start Creating
          </button>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-foreground text-xl font-bold text-center mb-2">How It Works</h3>
          <p className="text-muted-foreground text-sm text-center mb-8">
            Works on TikTok, Instagram Reels, YouTube Shorts and X.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[11px] font-bold text-primary mb-1">STEP {i + 1}</p>
                <h4 className="text-foreground font-bold text-sm mb-1.5">{s.title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracker */}
      <section id="creator-tracker" className="px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-foreground font-bold mb-4">Your Creator Dashboard</h3>

          {!user ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-4">Sign in to get your creator link and track your progress.</p>
              <button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold">
                Sign in to start
              </button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <label className="text-muted-foreground text-xs font-semibold block mb-1.5">Your Creator Link</label>
              <div className="flex flex-col sm:flex-row gap-2 mb-5">
                <input
                  readOnly
                  value={link}
                  className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground truncate"
                />
                <div className="flex gap-2">
                  <button onClick={copyLink} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy"}
                  </button>
                  <button onClick={share} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-muted-foreground text-[11px] font-semibold">Verified Signups</p>
                  <p className="text-foreground text-xl font-extrabold">{signups}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-muted-foreground text-[11px] font-semibold">Views</p>
                  <p className="text-foreground text-xl font-extrabold">
                    {data?.views_pending ? <span className="text-sm font-bold text-amber-500">Pending Verification</span> : views.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3 col-span-2 sm:col-span-1">
                  <p className="text-muted-foreground text-[11px] font-semibold">Current Tier</p>
                  <p className="text-foreground text-xl font-extrabold capitalize">{eligible ? eligible.name : "None yet"}</p>
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                <span>Progress to {target.name}</span>
                <span>{views.toLocaleString()}/{target.views.toLocaleString()} views · {signups}/{target.signups} signups</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.round(((views / target.views + signups / target.signups) / 2) * 100))}%` }}
                />
              </div>
              <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 mt-3">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Signups are verified automatically. We never show you anyone's personal details.
              </p>

              {data?.claim && (
                <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <p className="text-foreground text-sm font-bold flex items-center gap-1.5 capitalize">
                    <Clock className="w-4 h-4 text-primary" /> {data.claim.tier_requested} claim — {data.claim.status.replace("_", " ")}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 break-all">{data.claim.video_url}</p>
                  {data.claim.rejection_reason && (
                    <p className="text-destructive text-xs mt-2">Reason: {data.claim.rejection_reason}</p>
                  )}
                  {locked && (
                    <p className="text-muted-foreground text-[11px] mt-2">
                      Your claim is locked while we verify it — views and signups from now on won't change this claim.
                    </p>
                  )}
                </div>
              )}

              {data?.reward_plan && data.reward_expiration_date && (
                <div className="mt-3 rounded-xl border border-primary/40 bg-primary/15 p-4">
                  <p className="text-foreground text-sm font-bold capitalize">
                    🎉 {data.reward_plan} reward active until {new Date(data.reward_expiration_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Tiers */}
      <section className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-foreground text-xl font-bold text-center mb-2">Creator Tiers</h3>
          <p className="text-muted-foreground text-sm text-center mb-8">
            You need both the views <span className="font-semibold text-foreground">and</span> the signups. Your highest eligible tier is the one you claim — one reward per campaign.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CREATOR_TIERS.map((tier) => (
              <CreatorTierCard key={tier.id} tier={tier} views={views} signups={signups} locked={locked} onClaim={startClaim} />
            ))}
          </div>
          <p className="text-muted-foreground text-xs text-center mt-6">
            Scholar is not included in the Creator Rewards program.
          </p>
        </div>
      </section>

      {/* Rules */}
      <section className="px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-foreground font-bold mb-4">Program Rules</h3>
          <ul className="space-y-2">
            {UGC_RULES.map((r) => (
              <li key={r} className="text-muted-foreground text-xs leading-relaxed">• {r}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs mt-4">
            Any niche works — study, university life, AI, productivity, exam prep, flashcards, study podcasts, tutorials, reviews or storytelling. What we measure is legitimate new Testio users.
          </p>
        </div>
      </section>

      {claimTier && (
        <CreatorClaimModal tier={claimTier} onClose={() => setClaimTier(null)} onSubmitted={load} />
      )}
    </div>
  );
};

export default CreatorRewards;
