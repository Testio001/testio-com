import { useState } from "react";
import { Award, Share2, X } from "lucide-react";
import { Badge as BadgeType } from "@/hooks/useGamification";
import { motion, AnimatePresence } from "framer-motion";

const BADGE_ICONS: Record<string, { emoji: string; color: string }> = {
  streak_3: { emoji: "🌱", color: "from-green-400 to-green-600" },
  streak_7: { emoji: "📚", color: "from-blue-400 to-blue-600" },
  streak_14: { emoji: "🔥", color: "from-orange-400 to-orange-600" },
  streak_30: { emoji: "🎓", color: "from-purple-400 to-purple-600" },
  streak_60: { emoji: "🏆", color: "from-yellow-400 to-yellow-600" },
  streak_100: { emoji: "💎", color: "from-cyan-400 to-cyan-600" },
};

const ALL_BADGES = [
  { type: "streak_3", name: "The 3-Day Starter", threshold: 3 },
  { type: "streak_7", name: "The 7-Day Scholar", threshold: 7 },
  { type: "streak_14", name: "The 14-Day Achiever", threshold: 14 },
  { type: "streak_30", name: "The 30-Day Dean's List", threshold: 30 },
  { type: "streak_60", name: "The 60-Day Legend", threshold: 60 },
  { type: "streak_100", name: "The 100-Day Master", threshold: 100 },
];

interface BadgesDisplayProps {
  badges: BadgeType[];
  currentStreak: number;
}

const BadgesDisplay = ({ badges, currentStreak }: BadgesDisplayProps) => {
  const [shareModal, setShareModal] = useState<BadgeType | null>(null);
  const earnedTypes = new Set(badges.map(b => b.badge_type));

  const shareToStory = (badge: BadgeType) => {
    const text = `I've studied ${currentStreak} days in a row on Testio and earned the "${badge.badge_name}" badge! 🎉\n\nJoin me: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: `${badge.badge_name} - Testio`, text, url: window.location.origin });
    } else {
      navigator.clipboard.writeText(text);
    }
    setShareModal(null);
  };

  return (
    <>
      <div className="bg-testio-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" />
          <p className="text-foreground font-semibold text-sm">Badges</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_BADGES.map((def) => {
            const earned = earnedTypes.has(def.type);
            const icon = BADGE_ICONS[def.type];
            const badge = badges.find(b => b.badge_type === def.type);

            return (
              <button
                key={def.type}
                onClick={() => earned && badge && setShareModal(badge)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                  earned
                    ? "bg-secondary hover:bg-secondary/80 cursor-pointer"
                    : "bg-muted/30 opacity-40 cursor-default"
                }`}
              >
                <span className="text-2xl">{icon.emoji}</span>
                <span className="text-[10px] text-foreground font-medium text-center leading-tight">
                  {def.name}
                </span>
                {!earned && (
                  <span className="text-[9px] text-muted-foreground">{def.threshold}d</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShareModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              {/* Shareable Card */}
              <div className={`bg-gradient-to-br ${BADGE_ICONS[shareModal.badge_type]?.color || "from-primary to-primary"} rounded-2xl p-6 text-center text-white mb-4`}>
                <span className="text-5xl block mb-3">{BADGE_ICONS[shareModal.badge_type]?.emoji}</span>
                <p className="text-lg font-bold mb-1">{shareModal.badge_name}</p>
                <p className="text-sm opacity-90 mb-4">I've studied {currentStreak} days in a row on Testio!</p>
                <div className="bg-white/20 rounded-lg px-3 py-1.5 inline-block">
                  <span className="text-xs font-medium">testio.online</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => shareToStory(shareModal)}
                  className="flex-1 btn-testio-primary text-sm !py-2.5 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={() => setShareModal(null)}
                  className="px-4 py-2.5 bg-secondary rounded-full text-foreground text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BadgesDisplay;
