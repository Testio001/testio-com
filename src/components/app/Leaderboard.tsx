import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Flame, Medal } from "lucide-react";

interface LeaderboardEntry {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  uploads_used: number;
  display_name: string | null;
  email: string | null;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Session-scoped cache to avoid re-hitting the DB on every Dashboard mount.
  // 60s TTL — leaderboard doesn't need to be real-time.
  const CACHE_KEY = "lb:top5:v1";
  const RANK_KEY = user ? `lb:rank:${user.id}:v1` : null;
  const TTL_MS = 60_000;

  const readCache = <T,>(key: string): T | null => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { v, t } = JSON.parse(raw);
      if (Date.now() - t > TTL_MS) return null;
      return v as T;
    } catch { return null; }
  };
  const writeCache = (key: string, v: unknown) => {
    try { sessionStorage.setItem(key, JSON.stringify({ v, t: Date.now() })); } catch {}
  };

  const fetchLeaderboard = async () => {
    // Fast path: serve from cache if fresh
    const cached = readCache<LeaderboardEntry[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      setEntries(cached);
      if (user) {
        const inTop = cached.findIndex(e => e.user_id === user.id);
        if (inTop !== -1) {
          setUserRank(inTop + 1);
        } else if (RANK_KEY) {
          const cachedRank = readCache<number | null>(RANK_KEY);
          if (cachedRank !== null) setUserRank(cachedRank);
        }
      }
      setLoading(false);
      return;
    }

    // Use the security-definer function to get leaderboard data
    const { data: statsData } = await supabase.rpc("get_leaderboard", { limit_count: 5 });

    if (statsData && statsData.length > 0) {
      // Fetch display names via security-definer RPC (no email leak)
      const userIds = statsData.map(s => s.user_id);
      const { data: names } = await supabase.rpc("get_display_names", { _user_ids: userIds });

      const profileMap = new Map((names ?? []).map((n: any) => [n.user_id, n.display_name]));

      const getDisplayName = (userId: string) => {
        const name = profileMap.get(userId);
        return name || "Student";
      };

      const mapped = statsData.map(s => ({
        ...s,
        display_name: getDisplayName(s.user_id),
        email: null,
      }));

      setEntries(mapped);
      writeCache(CACHE_KEY, mapped);

      // Check if the current user is in the top 5
      if (user) {
        const inTop = mapped.findIndex(e => e.user_id === user.id);
        if (inTop === -1) {
          // User not in top 5 — fetch full leaderboard to find their rank.
          // Heavy query, so cache the resolved rank separately.
          const { data: allData } = await supabase.rpc("get_leaderboard", { limit_count: 1000 });
          if (allData) {
            const rank = allData.findIndex(e => e.user_id === user.id);
            const finalRank = rank === -1 ? null : rank + 1;
            setUserRank(finalRank);
            if (RANK_KEY) writeCache(RANK_KEY, finalRank);
          }
        } else {
          setUserRank(inTop + 1);
        }
      }
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
      {user && !entries.some(e => e.user_id === user.id) && (
        <div className="mt-4 text-center py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-sm text-muted-foreground">
            You're not in the Top 1,000 yet — keep studying to reach there! 📚
          </p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
