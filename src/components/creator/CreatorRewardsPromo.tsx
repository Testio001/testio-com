import { useNavigate } from "react-router-dom";
import { Video, Sparkles, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

type Variant = "home" | "pricing" | "dashboard" | "referral" | "profile";

const COPY: Record<Variant, { eyebrow: string; title: string; body: string; cta: string; note?: string }> = {
  home: {
    eyebrow: "Creator Rewards",
    title: "Your next Testio plan could be free.",
    body: "Create a viral video about Testio, bring real students to the platform, and unlock free Starter, Basic or Pro access.",
    cta: "Earn Free Access",
    note: "5K views + 20 signups can unlock your first free month.",
  },
  pricing: {
    eyebrow: "Want Pro for Free?",
    title: "Want Pro for Free? Create a Video for Testio!",
    body: "Post a video on TikTok, Reels, or Shorts. Hit view & signup milestones to unlock free Starter, Basic, or Pro plans.",
    cta: "View Creator Tiers & Claim",
  },
  dashboard: {
    eyebrow: "Creator Rewards",
    title: "🔥 Earn Your Next Plan Free",
    body: "Create content → Get views → Bring students → Unlock your plan.",
    cta: "View Rewards",
  },
  referral: {
    eyebrow: "Creator Rewards",
    title: "Turn your reach into free Testio access.",
    body: "Want more than referral uploads? Create content about Testio and unlock free paid plans through Creator Rewards.",
    cta: "Become a Creator",
  },
  profile: {
    eyebrow: "Creator Rewards",
    title: "Create content, get your plan free.",
    body: "Hit a creator milestone and we'll cover 30 days of Starter, Basic or Pro.",
    cta: "View Creator Rewards",
  },
};

/**
 * Context-aware Creator Rewards promo. Light-themed pages (marketing homepage)
 * pass `lightTheme` so it matches the surrounding section.
 */
const CreatorRewardsPromo = ({
  variant,
  className = "",
  lightTheme = false,
}: {
  variant: Variant;
  className?: string;
  lightTheme?: boolean;
}) => {
  const navigate = useNavigate();
  const copy = COPY[variant];

  const go = () => {
    trackEvent("creator_rewards_viewed", { source: variant });
    navigate("/creator-rewards");
  };

  if (lightTheme) {
    return (
      <div className={`rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 sm:p-8 ${className}`}>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600 mb-3">
          <Video className="w-3.5 h-3.5" /> {copy.eyebrow}
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">{copy.title}</h3>
        <p className="text-gray-600 mb-5 max-w-2xl">{copy.body}</p>
        <button
          onClick={go}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {copy.cta} <ArrowRight className="w-4 h-4" />
        </button>
        {copy.note && <p className="text-xs text-gray-500 mt-3">{copy.note}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">{copy.eyebrow}</p>
          <h3 className="text-foreground font-bold text-sm sm:text-base">{copy.title}</h3>
          <p className="text-muted-foreground text-xs mt-1">{copy.body}</p>
          {copy.note && <p className="text-[11px] text-muted-foreground mt-1">{copy.note}</p>}
          <button
            onClick={go}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {copy.cta} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatorRewardsPromo;
