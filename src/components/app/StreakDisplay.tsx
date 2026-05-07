import { Flame, Snowflake, Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserStats } from "@/hooks/useGamification";

interface StreakDisplayProps {
  stats: UserStats | null;
  compact?: boolean;
  userPlan?: string | null;
  onUpdated?: () => void;
}

const StreakDisplay = ({ stats, compact, userPlan, onUpdated }: StreakDisplayProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!stats) return null;

  const streak = stats.current_streak;
  const nextBonus = stats.current_streak > 0
    ? 10 - (stats.current_streak % 10)
    : 10;
  const isPaidPlus = ["pro", "scholar", "elite"].includes(userPlan || "");

  const useFreeze = async () => {
    if (!isPaidPlus) {
      toast({ title: "Pro feature", description: "Streak Freeze is available on Pro and above." });
      navigate("/pricing");
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("manage-gamification", {
        body: { action: "use-streak-freeze" },
      });
      if (data?.success) {
        toast({ title: "❄️ Streak Freeze activated", description: data.message });
        onUpdated?.();
      } else {
        toast({ title: "Can't activate", description: data?.message || "Try again later.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <Flame className={`w-4 h-4 ${streak > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
        <span className={`font-bold ${streak > 0 ? "text-orange-400" : "text-muted-foreground"}`}>{streak}</span>
      </div>
    );
  }

  return (
    <div className="bg-testio-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${streak > 0 ? "bg-orange-500/20" : "bg-muted"}`}>
            <Flame className={`w-5 h-5 ${streak > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-foreground font-bold text-lg">{streak} day streak</p>
            <p className="text-muted-foreground text-xs">Longest: {stats.longest_streak} days</p>
          </div>
        </div>
        {stats.streak_freezes > 0 && (
          <div className="flex items-center gap-1 bg-cyan-500/10 text-cyan-400 text-xs px-2 py-1 rounded-full">
            <Snowflake className="w-3 h-3" />
            {stats.streak_freezes} freeze{stats.streak_freezes > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {streak > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Next bonus upload</span>
            <span>{nextBonus} day{nextBonus > 1 ? "s" : ""}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
              style={{ width: `${((10 - nextBonus) / 10) * 100}%` }}
            />
          </div>
        </div>
      )}

      {streak === 0 && stats.longest_streak > 0 && (
        <p className="text-xs text-muted-foreground">
          Your streak was broken. Refer a friend to earn a Streak Freeze for next time!
        </p>
      )}

      {userPlan !== undefined && (
        <button
          onClick={useFreeze}
          disabled={busy}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-60"
          title={isPaidPlus ? "Protect your streak (1×/week)" : "Upgrade to Pro to unlock Streak Freeze"}
        >
          {isPaidPlus ? <Snowflake className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {isPaidPlus ? "Use Streak Freeze (1×/week)" : "Streak Freeze — Pro feature"}
        </button>
      )}
    </div>
  );
};

export default StreakDisplay;
