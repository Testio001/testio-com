import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, Brain, Crown, Eye, Gift, Headphones, RefreshCw, TrendingUp, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import AdminCodeGate from "@/components/app/AdminCodeGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type UsageMetric = {
  total: number;
  today: number;
};

type DashboardMetrics = {
  totalUsers: number;
  totalUploads: number;
  dailyActiveUsers: number;
  featureUsage: {
    quizzes: UsageMetric;
    flashcards: UsageMetric;
    podcasts: UsageMetric;
  };
  conversions: {
    paidUsers: number;
    rate: number;
  };
};

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

type PayingUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  subscription_plan: string;
  subscription_expires_at: string | null;
  created_at: string;
  is_active: boolean;
};

type PayingUsersData = {
  users: PayingUser[];
  total: number;
  active: number;
};

type ActiveUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  subscription_plan: string;
  uploads_used: number;
  uploads_limit: number;
  uploads_remaining: number;
  visit_count: number;
  last_visit_at: string | null;
};

const formatNumber = (value: number) => value.toLocaleString();

const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Users;
}) => (
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

const FeatureUsageCard = ({
  title,
  metric,
  icon: Icon,
}: {
  title: string;
  metric: UsageMetric;
  icon: typeof Brain;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div className="space-y-1">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{formatNumber(metric.total)}</CardTitle>
      </div>
      <div className="rounded-md border border-border bg-secondary/60 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">{formatNumber(metric.today)} created today</p>
    </CardContent>
  </Card>
);

const AdminDashboardContent = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [refLoading, setRefLoading] = useState(true);
  const [payingUsers, setPayingUsers] = useState<PayingUsersData | null>(null);
  const [payingLoading, setPayingLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[] | null>(null);
  const [activeLoading, setActiveLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "dashboard" },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Unable to load dashboard");
      setLoading(false);
      return;
    }

    setMetrics(data as DashboardMetrics);
    setLoading(false);
  }, []);

  const fetchReferrals = useCallback(async () => {
    setRefLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "referrals" },
    });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Unable to load referrals");
      setRefLoading(false);
      return;
    }
    setReferrals(data as ReferralData);
    setRefLoading(false);
  }, []);

  const fetchPayingUsers = useCallback(async () => {
    setPayingLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "paying-users" },
    });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Unable to load paying users");
      setPayingLoading(false);
      return;
    }
    setPayingUsers(data as PayingUsersData);
    setPayingLoading(false);
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    setActiveLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "active-users" },
    });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Unable to load active users");
      setActiveLoading(false);
      return;
    }
    setActiveUsers((data?.users ?? []) as ActiveUser[]);
    setActiveLoading(false);
  }, []);

  useEffect(() => {
    void fetchMetrics();
    void fetchReferrals();
    void fetchPayingUsers();
    void fetchActiveUsers();
  }, [fetchMetrics, fetchReferrals, fetchPayingUsers, fetchActiveUsers]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Aggregate overview only.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void fetchMetrics();
              void fetchReferrals();
              void fetchPayingUsers();
              void fetchActiveUsers();
            }}
            disabled={loading || refLoading || payingLoading || activeLoading}
          >
            <RefreshCw className={`h-4 w-4 ${loading || refLoading || payingLoading || activeLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total users"
            value={loading ? "—" : formatNumber(metrics?.totalUsers ?? 0)}
            description="All registered accounts"
            icon={Users}
          />
          <MetricCard
            title="Total uploads"
            value={loading ? "—" : formatNumber(metrics?.totalUploads ?? 0)}
            description="Documents created so far"
            icon={Upload}
          />
          <MetricCard
            title="Daily active users"
            value={loading ? "—" : formatNumber(metrics?.dailyActiveUsers ?? 0)}
            description="Unique users active today"
            icon={Activity}
          />
          <MetricCard
            title="Conversions"
            value={loading ? "—" : formatNumber(metrics?.conversions.paidUsers ?? 0)}
            description={loading ? "Paid users and conversion rate" : `${metrics?.conversions.rate.toFixed(1)}% active paid conversion rate`}
            icon={BarChart3}
          />
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Feature usage</h2>
            <p className="text-sm text-muted-foreground">Lifetime totals with today&apos;s activity.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureUsageCard title="Quiz" metric={metrics?.featureUsage.quizzes ?? { total: 0, today: 0 }} icon={Brain} />
            <FeatureUsageCard title="Flashcards" metric={metrics?.featureUsage.flashcards ?? { total: 0, today: 0 }} icon={BarChart3} />
            <FeatureUsageCard title="Podcast" metric={metrics?.featureUsage.podcasts ?? { total: 0, today: 0 }} icon={Headphones} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Paying users</h2>
            {!payingLoading && payingUsers && (
              <span className="text-sm text-muted-foreground">
                ({payingUsers.active} active / {payingUsers.total} total)
              </span>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All paid subscribers</CardTitle>
              <CardDescription>Every user on a Starter, Basic, Pro, Scholar, or Elite plan</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {payingLoading && (
                    <tr><td colSpan={5} className="py-3 text-muted-foreground">Loading…</td></tr>
                  )}
                  {!payingLoading && (payingUsers?.users ?? []).length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-muted-foreground">No paying users yet.</td></tr>
                  )}
                  {(payingUsers?.users ?? []).map((u) => (
                    <tr key={u.user_id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{u.display_name || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{u.email || "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="default" className="uppercase text-[10px]">{u.subscription_plan}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={u.is_active ? "default" : "outline"} className="text-[10px]">
                          {u.is_active ? "Active" : "Expired"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                        {u.subscription_expires_at ? new Date(u.subscription_expires_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Top 30 most active users</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranked by uploads used</CardTitle>
              <CardDescription>Uploads consumed, remaining quota, and lifetime site visits</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium text-right">Uploads used</th>
                    <th className="py-2 pr-3 font-medium text-right">Remaining</th>
                    <th className="py-2 pr-3 font-medium text-right">Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoading && (
                    <tr><td colSpan={6} className="py-3 text-muted-foreground">Loading…</td></tr>
                  )}
                  {!activeLoading && (activeUsers ?? []).length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-muted-foreground">No activity yet.</td></tr>
                  )}
                  {(activeUsers ?? []).map((u, i) => (
                    <tr key={u.user_id} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3">
                        <div>{u.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="uppercase text-[10px]">{u.subscription_plan}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">{u.uploads_used} / {u.uploads_limit}</td>
                      <td className="py-2 pr-3 text-right">{u.uploads_remaining}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          {u.visit_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Referrals</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              title="Total referrals"
              value={refLoading ? "—" : formatNumber(referrals?.totalReferrals ?? 0)}
              description="All-time signups via referral link"
              icon={Users}
            />
            <MetricCard
              title="Paid referrals"
              value={refLoading ? "—" : formatNumber(referrals?.paidReferrals ?? 0)}
              description="Referred users currently on a paid plan"
              icon={BarChart3}
            />
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
                  {refLoading && (
                    <tr><td colSpan={4} className="py-3 text-muted-foreground">Loading…</td></tr>
                  )}
                  {!refLoading && (referrals?.topReferrers ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-muted-foreground">No referrals yet.</td></tr>
                  )}
                  {(referrals?.topReferrers ?? []).slice(0, 25).map((r) => (
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
                  {refLoading && (
                    <tr><td colSpan={4} className="py-3 text-muted-foreground">Loading…</td></tr>
                  )}
                  {!refLoading && (referrals?.rows ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-muted-foreground">No referrals yet.</td></tr>
                  )}
                  {(referrals?.rows ?? []).map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">
                        <div>{r.referred_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.referred_email || "—"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={r.referred_is_paid ? "default" : "outline"} className="uppercase text-[10px]">
                          {r.referred_plan}
                        </Badge>
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
        </section>
      </div>
    </div>
  );
};

const AdminDashboard = () => (
  <AdminCodeGate
    title="Admin Dashboard"
    description="Sign in with an admin account to view the dashboard."
  >
    {() => <AdminDashboardContent />}
  </AdminCodeGate>
);

export default AdminDashboard;