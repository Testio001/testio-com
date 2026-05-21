import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BarChart3, Gift, RefreshCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import AdminCodeGate from "@/components/app/AdminCodeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ReferralRow = {
  created_at: string;
  referrer_email: string | null;
  referrer_name: string | null;
  referred_email: string | null;
  referred_name: string | null;
  referred_plan: string;
  referred_is_paid: boolean;
};

type ReferralAgg = {
  user_id: string;
  email: string | null;
  name: string | null;
  total: number;
  paid: number;
};

type ReferralData = {
  totalReferrals: number;
  paidReferrals: number;
  topReferrers: ReferralAgg[];
  rows: ReferralRow[];
};

const formatNumber = (n: number) => n.toLocaleString();

const MetricCard = ({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: typeof Users }) => (
  <Card>
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div className="space-y-1">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </div>
      <div className="rounded-md border border-border bg-secondary/60 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const AdminReferralsContent = () => {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "referrals" },
    });
    if (error || res?.error) {
      toast.error(error?.message || res?.error || "Unable to load referrals");
      setLoading(false);
      return;
    }
    setData(res as ReferralData);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Link to="/admin-dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to dashboard
            </Link>
            <h1 className="text-3xl font-semibold flex items-center gap-2"><Gift className="h-7 w-7 text-primary" /> Referrals</h1>
            <p className="text-sm text-muted-foreground">All-time referral activity.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title="Total referrals" value={loading ? "—" : formatNumber(data?.totalReferrals ?? 0)} description="All-time signups via referral link" icon={Users} />
          <MetricCard title="Paid referrals" value={loading ? "—" : formatNumber(data?.paidReferrals ?? 0)} description="Referred users currently on a paid plan" icon={BarChart3} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top referrers</CardTitle>
            <CardDescription>Sorted by paid conversions</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Referrer</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium text-right">Paid</th>
                  <th className="py-2 pr-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="py-3 text-muted-foreground">Loading…</td></tr>}
                {!loading && (data?.topReferrers ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-muted-foreground">No referrals yet.</td></tr>
                )}
                {(data?.topReferrers ?? []).map((r) => (
                  <tr key={r.user_id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{r.name || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.email || "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-primary">{r.paid}</td>
                    <td className="py-2 pr-3 text-right">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent referred users</CardTitle>
            <CardDescription>Who referred each new signup (latest 200)</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Referred user</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Referred by</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="py-3 text-muted-foreground">Loading…</td></tr>}
                {!loading && (data?.rows ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-muted-foreground">No referrals yet.</td></tr>
                )}
                {(data?.rows ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">
                      <div>{r.referred_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.referred_email || "—"}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.referred_is_paid ? "default" : "outline"} className="uppercase text-[10px]">{r.referred_plan}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <div>{r.referrer_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.referrer_email || "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const AdminReferrals = () => (
  <AdminCodeGate title="Admin Referrals" description="Sign in with an admin account to view referrals.">
    {() => <AdminReferralsContent />}
  </AdminCodeGate>
);

export default AdminReferrals;