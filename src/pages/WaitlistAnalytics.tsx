import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Music, Users, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ADMIN_EMAIL = "testimony.bankole@elizadeuniversity.edu.ng";

interface WaitlistEntry {
  id: string;
  created_at: string;
  genre: string;
  would_use_daily: string;
  email: string;
}

const WaitlistAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase.from("study_music_waitlist" as any).select("*").order("created_at", { ascending: false });
    if (data) setEntries(data as any);
    setLoading(false);
  };

  // Simple admin check
  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const genreCounts: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};
  entries.forEach((e) => {
    genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
    dailyCounts[e.would_use_daily] = (dailyCounts[e.would_use_daily] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 sm:px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Study Music Waitlist Analytics</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Signups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{entries.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Top Genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Daily Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {dailyCounts["Yes, definitely!"] || 0}
              </p>
              <p className="text-xs text-muted-foreground">said "Yes, definitely!"</p>
            </CardContent>
          </Card>
        </div>

        {/* Genre breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Genre Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => (
                <div key={genre} className="flex items-center gap-3">
                  <span className="text-sm text-foreground w-24">{genre}</span>
                  <div className="flex-1 bg-secondary rounded-full h-3">
                    <div
                      className="bg-primary rounded-full h-3 transition-all"
                      style={{ width: `${(count / entries.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entries table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">All Submissions ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Email</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Genre</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Daily?</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-foreground">{e.email}</td>
                        <td className="py-2 pr-4 text-foreground">{e.genre}</td>
                        <td className="py-2 pr-4 text-foreground">{e.would_use_daily}</td>
                        <td className="py-2 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WaitlistAnalytics;
