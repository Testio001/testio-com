import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, Brain, Headphones, RefreshCw, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import AdminCodeGate from "@/components/app/AdminCodeGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const AdminDashboardContent = ({ code }: { code: string }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("admin-ops", {
      body: { action: "dashboard", code },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Unable to load dashboard");
      setLoading(false);
      return;
    }

    setMetrics(data as DashboardMetrics);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Aggregate overview only.</p>
          </div>
          <Button variant="outline" onClick={() => void fetchMetrics()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
      </div>
    </div>
  );
};

const AdminDashboard = () => (
  <AdminCodeGate
    title="Admin Dashboard"
    description="Enter the admin code to view the aggregate metrics dashboard."
  >
    {(code) => <AdminDashboardContent code={code} />}
  </AdminCodeGate>
);

export default AdminDashboard;