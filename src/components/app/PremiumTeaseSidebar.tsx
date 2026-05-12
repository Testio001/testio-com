import { Lock, Sparkles, Mic, Brain, MessageSquare, Zap, Infinity as InfinityIcon, Crown, Headphones, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Tier = "Basic" | "Pro" | "Scholar";

interface Perk {
  icon: typeof Lock;
  title: string;
  description: string;
  tier: Tier;
}

const PERKS: Perk[] = [
  { icon: Zap, title: "More monthly uploads", description: "15/mo on Basic · 40/mo on Pro · Unlimited on Scholar", tier: "Basic" },
  { icon: Brain, title: "Larger quizzes", description: "Up to 21 questions per quiz instead of the free 20-q cap", tier: "Basic" },
  { icon: MessageSquare, title: "More AI tutor questions", description: "21 per document on Basic, unlimited on Pro+", tier: "Basic" },
  { icon: Mic, title: "Longer podcasts", description: "7 min (Basic) · 12 min (Pro) · 15 min (Scholar)", tier: "Basic" },
  { icon: Headphones, title: "More podcast credits", description: "3 / 6 / 9 episodes per month — plus top-up packs", tier: "Pro" },
  { icon: InfinityIcon, title: "Unlimited quizzes", description: "Generate as many quizzes as you need", tier: "Pro" },
  { icon: Sparkles, title: "Priority processing", description: "Skip the queue when traffic spikes", tier: "Pro" },
  { icon: Calendar, title: "Early access to new features", description: "Try beta features before everyone else", tier: "Scholar" },
];

const tierColor: Record<Tier, string> = {
  Basic: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Pro: "bg-primary/15 text-primary border-primary/30",
  Scholar: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

interface Props {
  subscriptionPlan: string;
}

const PLAN_RANK: Record<string, number> = { free: 0, starter: 0, basic: 1, pro: 2, scholar: 3, elite: 4 };

const PremiumTeaseSidebar = ({ subscriptionPlan }: Props) => {
  const navigate = useNavigate();
  const userRank = PLAN_RANK[subscriptionPlan] ?? 0;

  // Only show locked perks the user doesn't already have
  const locked = PERKS.filter((p) => (PLAN_RANK[p.tier.toLowerCase()] ?? 99) > userRank);
  if (locked.length === 0) return null;

  return (
    <aside className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Premium features</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Unlocked when you upgrade.
        </p>

        <ul className="space-y-2.5">
          {locked.map((perk) => (
            <li
              key={perk.title}
              className="relative rounded-lg border border-border/40 bg-muted/20 p-3 opacity-60 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 w-7 h-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                  <perk.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-semibold text-foreground/80 truncate">{perk.title}</p>
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{perk.description}</p>
                  <span className={`inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierColor[perk.tier]}`}>
                    {perk.tier}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={() => navigate("/pricing")}
          className="btn-testio-primary w-full text-xs !py-2 mt-4 flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Upgrade to unlock
        </button>
      </div>
    </aside>
  );
};

export default PremiumTeaseSidebar;
