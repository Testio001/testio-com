import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminCodeGate from "@/components/app/AdminCodeGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type LookupResult = {
  user_id: string;
  email: string;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
};

const AdminStreakAssignContent = () => {
  const [email, setEmail] = useState("");
  const [streak, setStreak] = useState("");
  const [target, setTarget] = useState<LookupResult | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setTarget(null);
    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "lookup-user", email: email.trim() },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message || data?.error || "Lookup failed"); return; }
    const row = data as LookupResult | null;
    if (!row) { toast.error("No user found with that email"); return; }
    setTarget(row);
    setStreak(String(row.current_streak));
  };

  const apply = async () => {
    if (!target) return;
    const n = parseInt(streak, 10);
    if (Number.isNaN(n) || n < 0) { toast.error("Enter a valid non-negative number"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "set-streak", targetUserId: target.user_id, streak: n },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message || data?.error || "Update failed"); return; }
    toast.success(`Streak updated to ${n} for ${target.email}`);
    setTarget({ ...target, current_streak: n, longest_streak: Math.max(target.longest_streak, n) });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Streak Admin</h1>
          <p className="text-sm text-muted-foreground">Code-gated admin tool</p>
        </div>

        <Card className="p-4 space-y-3">
          <label className="text-sm font-medium">User email</label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
            />
            <Button onClick={lookup} disabled={busy}>Find</Button>
          </div>
        </Card>

        {target && (
          <Card className="p-4 space-y-3">
            <div className="text-sm">
              <div><span className="text-muted-foreground">Name:</span> {target.display_name ?? "—"}</div>
              <div><span className="text-muted-foreground">Email:</span> {target.email}</div>
              <div><span className="text-muted-foreground">Current streak:</span> {target.current_streak}</div>
              <div><span className="text-muted-foreground">Longest streak:</span> {target.longest_streak}</div>
            </div>
            <label className="text-sm font-medium">New current streak</label>
            <Input
              type="number"
              min={0}
              value={streak}
              onChange={(e) => setStreak(e.target.value)}
            />
            <Button onClick={apply} disabled={busy} className="w-full">
              {busy ? "Updating…" : "Set streak"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

const AdminStreakAssign = () => (
  <AdminCodeGate
    title="Streak Admin"
    description="Sign in with an admin account to manage streaks."
  >
    {() => <AdminStreakAssignContent />}
  </AdminCodeGate>
);

export default AdminStreakAssign;