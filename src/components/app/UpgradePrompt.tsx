import { Crown, Gift, Flame, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsAndroidApp } from "@/hooks/useIsAndroidApp";
import { useCurrency, priceFor, periodFor, entryPlanFor } from "@/hooks/useCurrency";

interface UpgradePromptProps {
  onRefer: () => void;
  onUpgrade?: () => void;
  type?: "upload" | "podcast" | "quiz";
  streakBroken?: boolean;
  /** User's current plan: free | basic | pro | scholar */
  currentPlan?: string;
}

const UpgradePrompt = ({ onRefer, onUpgrade, type = "upload", streakBroken, currentPlan = "free" }: UpgradePromptProps) => {
  const navigate = useNavigate();
  const isAndroidApp = useIsAndroidApp();
  const { currency } = useCurrency();
  const entryPlan = entryPlanFor(currency); // "starter" for NGN, "basic" for USD
  const entryPrice = priceFor(entryPlan, currency);
  const entryName = entryPlan === "starter" ? "Starter" : "Basic";
  const proPrice = priceFor("pro", currency);
  const period = periodFor(currency);

  // Scholar users see no upgrade CTA (top plan)
  const isTopPlan = currentPlan === "scholar";
  // Refer-and-earn is open to everyone — but the reward only unlocks once
  // the referred friend upgrades to a paid plan.
  const canRefer = true;

  // Tier escalation
  const upgradeCopy: Record<string, { title: string; description: string; cta: string; pressure: "high" | "medium" | "soft" }> = {
    free: {
      title: type === "upload" ? "Upload limit reached" : type === "podcast" ? "Free podcast preview" : "Quiz question limit",
      description:
        type === "upload"
          ? `You've used all your free uploads. Upgrade to ${entryName} for ${entryPrice}${period} for more access or refer a friend to earn 1 bonus upload.`
          : type === "podcast"
          ? "Free plans include a 5-minute podcast preview. Upgrade for full-length podcasts with unlimited depth."
          : "Free plans allow up to 20 quiz questions. Upgrade for unlimited questions per document.",
      cta: `Upgrade to ${entryName}`,
      pressure: "high",
    },
    starter: {
      title: type === "podcast" ? "Podcasts not on Starter" : "Ready for more?",
      description:
        type === "podcast"
          ? `Starter doesn't include podcasts. Upgrade to Basic (${priceFor("basic", currency)}${period}) or higher to unlock study podcasts.`
          : `Basic gives you 15 uploads/month, podcasts and more AI Tutor questions — only ${priceFor("basic", currency)}${period}.`,
      cta: "Upgrade to Basic",
      pressure: "high",
    },
    basic: {
      title: "Ready for more?",
      description: `Pro gives you 40 uploads/month, 6 long-form podcasts, and 41 AI Tutor questions per doc — only ${proPrice}${period}.`,
      cta: "Upgrade to Pro",
      pressure: "medium",
    },
    pro: {
      title: "Need even more?",
      description: "Scholar unlocks unlimited AI Tutor, 9 podcasts/month at 15 min each, and early access to new features.",
      cta: "Upgrade to Scholar",
      pressure: "soft",
    },
    scholar: {
      title: "You're on the top plan 👑",
      description: "Thanks for being a Scholar member! You have access to everything Testio offers.",
      cta: "",
      pressure: "soft",
    },
  };

  const msg = upgradeCopy[currentPlan] || upgradeCopy.free;
  const Icon = currentPlan === "pro" ? GraduationCap : Crown;

  return (
    <div className={`bg-testio-card rounded-xl p-5 border ${msg.pressure === "high" ? "border-primary/30" : msg.pressure === "medium" ? "border-primary/20" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-foreground font-semibold text-sm">{msg.title}</h3>
      </div>
      <p className="text-muted-foreground text-xs mb-4">{msg.description}</p>

      {streakBroken && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Flame className="w-4 h-4 text-orange-400 mt-0.5" />
          <p className="text-xs text-orange-300">
            Your streak was broken! Refer 1 friend to reactivate it and earn a Streak Freeze for next time.
          </p>
        </div>
      )}

      {!isTopPlan && (
        <div className="flex gap-2">
          {!isAndroidApp && msg.cta && (
            <button
              onClick={() => navigate("/pricing")}
              className={`flex-1 text-xs !py-2.5 flex items-center justify-center gap-1.5 ${msg.pressure === "soft" ? "py-2.5 bg-secondary hover:bg-secondary/80 rounded-full font-medium text-foreground transition-colors" : "btn-testio-primary"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {msg.cta}
            </button>
          )}
          <button
            onClick={onRefer}
            title="You earn 1 bonus upload when your friend upgrades to a paid plan"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary hover:bg-secondary/80 rounded-full text-xs font-medium text-foreground transition-colors"
          >
            <Gift className="w-3.5 h-3.5" /> Refer a Friend
          </button>
        </div>
      )}
    </div>
  );
};

export default UpgradePrompt;
