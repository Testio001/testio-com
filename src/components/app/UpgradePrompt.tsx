import { Crown, Gift, Share2, Flame } from "lucide-react";

interface UpgradePromptProps {
  onRefer: () => void;
  onUpgrade: () => void;
  type?: "upload" | "podcast" | "quiz";
  streakBroken?: boolean;
}

const UpgradePrompt = ({ onRefer, onUpgrade, type = "upload", streakBroken }: UpgradePromptProps) => {
  const messages = {
    upload: {
      title: "Upload limit reached",
      description: "You've used all your free uploads. Upgrade for unlimited access or refer a friend to earn 1 bonus upload.",
    },
    podcast: {
      title: "Free podcast preview",
      description: "Free plans include a 5-minute podcast preview. Upgrade for full-length podcasts with unlimited depth.",
    },
    quiz: {
      title: "Quiz question limit",
      description: "Free plans allow up to 20 quiz questions. Upgrade for unlimited questions per document.",
    },
  };

  const msg = messages[type];

  return (
    <div className="bg-testio-card rounded-xl p-5 border border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Crown className="w-4 h-4 text-primary" />
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

      <div className="flex gap-2">
        <button
          onClick={onUpgrade}
          className="flex-1 btn-testio-primary text-xs !py-2.5 flex items-center justify-center gap-1.5"
        >
          <Crown className="w-3.5 h-3.5" /> Upgrade
        </button>
        <button
          onClick={onRefer}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary hover:bg-secondary/80 rounded-full text-xs font-medium text-foreground transition-colors"
        >
          <Gift className="w-3.5 h-3.5" /> Refer a Friend
        </button>
      </div>
    </div>
  );
};

export default UpgradePrompt;
