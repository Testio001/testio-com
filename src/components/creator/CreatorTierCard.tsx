import { Check, Crown, Lock } from "lucide-react";
import { CreatorTier, isTierEligible } from "@/lib/creatorRewards";

const CreatorTierCard = ({
  tier,
  views,
  signups,
  locked,
  onClaim,
}: {
  tier: CreatorTier;
  views: number;
  signups: number;
  /** True while a claim is already submitted/under review — claiming is disabled. */
  locked: boolean;
  onClaim: (tier: CreatorTier) => void;
}) => {
  const eligible = isTierEligible(tier, views, signups);

  return (
    <div
      className={`relative rounded-2xl p-6 border transition-all ${
        tier.featured
          ? "border-primary bg-primary/10 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
          : "border-border bg-card"
      }`}
    >
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Most Popular
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        {tier.featured && <Crown className="w-4 h-4 text-primary" />}
        <h3 className="text-foreground font-bold text-lg">{tier.name} Tier</h3>
      </div>
      <p className="text-primary font-semibold text-sm mb-5">{tier.reward}</p>

      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className={`w-4 h-4 shrink-0 ${views >= tier.views ? "text-primary" : "text-muted-foreground/40"}`} />
          {tier.views.toLocaleString()} verified views
        </li>
        <li className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className={`w-4 h-4 shrink-0 ${signups >= tier.signups ? "text-primary" : "text-muted-foreground/40"}`} />
          {tier.signups} verified signups
        </li>
      </ul>

      <button
        disabled={!eligible || locked}
        onClick={() => onClaim(tier)}
        className={`w-full py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all ${
          eligible && !locked
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {!eligible && <Lock className="w-3.5 h-3.5" />}
        {locked ? "Claim under review" : eligible ? tier.cta : "Milestone not reached"}
      </button>
    </div>
  );
};

export default CreatorTierCard;
