import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Flame, Medal } from "lucide-react";

interface LeaderboardEntry {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  display_name: string | null;
  email: string | null;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    // Fetch top users by current streak
    const { data: statsData } = await supabase
      .from("user_stats")
      .select("user_id, current_streak, longest_streak")
      .gt("current_streak", 0)
      .order("current_streak", { ascending: false })
      .limit(10);

    if (statsData && statsData.length > 0) {
      // Fetch display names
      const userIds = statsData.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setEntries(statsData.map(s => ({
        ...s,
        display_name: profileMap.get(s.user_id) || "Student",
      })));
    }
    setLoading(false);
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return "text-yellow-400";
    if (index === 1) return "text-gray-300";
    if (index === 2) return "text-orange-400";
    return "text-muted-foreground";
  };

  if (loading) return null;
  if (entries.length === 0) {
    return (
      <div className="bg-testio-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <p className="text-foreground font-semibold text-sm">Top Students This Week</p>
        </div>
        <p className="text-muted-foreground text-xs text-center py-4">
          No active streaks yet. Start studying daily to appear here!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-testio-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <p className="text-foreground font-semibold text-sm">Top Students This Week</p>
      </div>
      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const isMe = entry.user_id === user?.id;
          return (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                isMe ? "bg-primary/10 border border-primary/20" : ""
              }`}
            >
              <span className={`text-sm font-bold w-5 ${getMedalColor(i)}`}>
                {i < 3 ? <Medal className={`w-4 h-4 ${getMedalColor(i)}`} /> : `${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                  {entry.display_name}{isMe ? " (You)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-sm font-bold text-foreground">{entry.current_streak}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
