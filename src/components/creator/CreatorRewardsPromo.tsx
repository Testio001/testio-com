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

  if (variant === "home" || lightTheme) {
    return (
      <div className={`surface rounded-2xl p-6 sm:p-8 flex flex-col ${className}`}>
        <p className="eyebrow mb-3 inline-flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5" /> {copy.eyebrow}
        </p>
        <h3 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-3">{copy.title}</h3>
        <p className="text-muted-foreground mb-6 max-w-2xl">{copy.body}</p>
        {copy.note && (
          <p className="text-sm text-foreground mb-7 rounded-xl border border-border bg-background px-4 py-3">{copy.note}</p>
        )}
        <button onClick={go} className="btn-testio-primary self-start mt-auto">
          {copy.cta} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`surface rounded-2xl p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="eyebrow mb-1">{copy.eyebrow}</p>
          <h3 className="text-foreground font-semibold text-sm sm:text-base">{copy.title}</h3>
          <p className="text-muted-foreground text-xs mt-1">{copy.body}</p>
          {copy.note && <p className="text-[11px] text-muted-foreground mt-1">{copy.note}</p>}
          <button
            onClick={go}
            className="pressable mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            {copy.cta} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatorRewardsPromo;
