import { useState } from "react";
import { Share2, Copy, Check, Users, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CreatorRewardsPromo from "@/components/creator/CreatorRewardsPromo";

interface ReferralCardProps {
  referralLink: string;
  referralsThisMonth: number;
  maxReferrals: number;
  canRefer: boolean;
  daysUntilReset: number;
  referralsRemaining: number;
  uploadsRemaining: number;
  totalAllowed: number;
}

const ReferralCard = ({
  referralLink,
  referralsThisMonth,
  maxReferrals,
  canRefer,
  daysUntilReset,
  referralsRemaining,
  uploadsRemaining,
  totalAllowed,
}: ReferralCardProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with your friends" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Testio!",
          text: "Study smarter with AI-powered notes, flashcards & podcasts. Use my link to get a bonus upload!",
          url: referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <div className="bg-testio-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-semibold text-sm">Refer Friends</p>
          <p className="text-muted-foreground text-xs">
            {canRefer
              ? `${referralsRemaining} referral${referralsRemaining > 1 ? "s" : ""} left this month`
              : `Limit reached. Resets in ${daysUntilReset} day${daysUntilReset > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        You'll earn <span className="text-primary font-medium">+1 bonus upload</span> when your friend upgrades to any paid plan (Starter and up).
      </p>

      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: maxReferrals }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < referralsThisMonth ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-medium text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-testio-green" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button
          onClick={shareLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-xs font-medium text-primary transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {!canRefer && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          You've reached your referral limit for this month. You can still share your link to help friends, but your next reward slot opens in {daysUntilReset} day{daysUntilReset > 1 ? "s" : ""}.
        </p>
      )}

      <CreatorRewardsPromo variant="referral" className="mt-4" />
    </div>
  );
};

export default ReferralCard;
