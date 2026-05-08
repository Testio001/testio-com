import StreakDisplay from "./StreakDisplay";
import ReferralCard from "./ReferralCard";
import BadgesDisplay from "./BadgesDisplay";
import Leaderboard from "./Leaderboard";
import { Upload, Crown } from "lucide-react";
import type { GamificationData } from "@/hooks/useGamification";

interface GamificationSidebarProps {
  onUpgrade: () => void;
  gamification: GamificationData;
  userPlan?: string | null;
  onUpload?: () => void;
}

const GamificationSidebar = ({ onUpgrade, gamification, userPlan, onUpload }: GamificationSidebarProps) => {
  const {
    stats,
    badges,
    loading,
    uploadsRemaining,
    totalUploadsAllowed,
    referralsRemaining,
    canRefer,
    daysUntilReferralReset,
    getReferralLink,
    MAX_REFERRALS_PER_MONTH,
  } = gamification;

  if (loading || !stats) return null;

  return (
    <div className="space-y-4">
      {/* Uploads counter */}
      <button
        type="button"
        onClick={() => {
          if (uploadsRemaining <= 0) onUpgrade();
          else onUpload?.();
        }}
        className="w-full text-left bg-testio-card rounded-xl p-4 hover:ring-2 hover:ring-primary/40 transition-all"
        title={uploadsRemaining <= 0 ? "Upload limit reached — upgrade for more" : "Tap to upload a document"}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            <p className="text-foreground font-semibold text-sm">Uploads</p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {stats.uploads_used}/{totalUploadsAllowed}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              uploadsRemaining <= 0
                ? "bg-destructive"
                : uploadsRemaining <= 1
                ? "bg-yellow-400"
                : "bg-primary"
            }`}
            style={{ width: `${Math.min(100, (stats.uploads_used / totalUploadsAllowed) * 100)}%` }}
          />
        </div>
        {uploadsRemaining <= 0 ? (
          <div className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary/10 rounded-lg text-xs font-medium text-primary">
            <Crown className="w-3 h-3" /> Get more uploads
          </div>
        ) : (
          <div className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary/10 rounded-lg text-xs font-medium text-primary">
            <Upload className="w-3 h-3" /> Tap to upload
          </div>
        )}
        {stats.bonus_uploads > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Includes {stats.bonus_uploads} bonus upload{stats.bonus_uploads > 1 ? "s" : ""} from streaks & referrals
          </p>
        )}
      </button>

      <StreakDisplay stats={stats} userPlan={userPlan} onUpdated={() => gamification.fetchStats()} />

      <ReferralCard
        referralLink={getReferralLink()}
        referralsThisMonth={stats.referrals_this_month}
        maxReferrals={MAX_REFERRALS_PER_MONTH}
        canRefer={canRefer}
        daysUntilReset={daysUntilReferralReset}
        referralsRemaining={referralsRemaining}
        uploadsRemaining={uploadsRemaining}
        totalAllowed={totalUploadsAllowed}
      />

      <BadgesDisplay badges={badges} currentStreak={stats.current_streak} />

      <Leaderboard />
    </div>
  );
};

export default GamificationSidebar;
