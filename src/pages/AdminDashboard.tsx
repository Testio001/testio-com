import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Crown,
  DollarSign,
  Gift,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

const ADMIN_EMAIL = "Thetechworld105@gmail.com";

interface Analytics {
  totalUsers: number;
  payingUsers: number;
  revenue: number;
  referrals: number;
  pending: number;
  failed: number;
  planBreakdown: Record<string, number>;
  expiringSoon: any[];
  uploadsLeft: any[];
  topReferrers: any[];
  recentPayments: any[];
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    payingUsers: 0,
    revenue: 0,
    referrals: 0,
    pending: 0,
    failed: 0,
    planBreakdown: {},
    expiringSoon: [],
    uploadsLeft: [],
    topReferrers: [],
    recentPayments: [],
  });

  const fetchAnalytics = async () => {
    setLoading(true);

    try {
      // =========================
      // PROFILES
      // =========================
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // =========================
      // PAYMENTS
      // =========================
      const { data: payments, error: paymentsError } = await supabase
        .from("korapay_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      // =========================
      // USER STATS
      // =========================
      const { data: stats, error: statsError } = await supabase
        .from("user_stats")
        .select("*");

      if (statsError) throw statsError;

      // =========================
      // REFERRALS
      // =========================
      const { data: referrals, error: referralsError } = await supabase
        .from("referrals")
        .select("*");

      if (referralsError) {
        console.log("No referrals table found");
      }

      // =========================
      // TOTAL USERS
      // =========================
      const totalUsers = profiles?.length || 0;

      // =========================
      // PAYING USERS
      // =========================
      const payingUsers =
        profiles?.filter(
          (p) =>
            p.subscription_plan &&
            p.subscription_plan !== "free"
        ).length || 0;

      // =========================
      // PAYMENT STATS
      // =========================
      const successfulPayments =
        payments?.filter((p) => p.status === "success") || [];

      const pendingPayments =
        payments?.filter((p) => p.status === "pending") || [];

      const failedPayments =
        payments?.filter((p) => p.status === "failed") || [];

      // =========================
      // REVENUE
      // =========================
      const revenue = successfulPayments.reduce(
        (sum, p) => sum + (p.amount_ngn || 0),
        0
      );

      // =========================
      // PLAN BREAKDOWN
      // =========================
      const planBreakdown: Record<string, number> = {};

      profiles?.forEach((p) => {
        const plan = p.subscription_plan || "free";

        if (!planBreakdown[plan]) {
          planBreakdown[plan] = 0;
        }

        planBreakdown[plan]++;
      });

      // =========================
      // EXPIRING SOON
      // =========================
      const expiringSoon =
        profiles?.filter((p) => {
          if (!p.subscription_expires_at) return false;

          const expiry = new Date(p.subscription_expires_at);
          const now = new Date();

          const diff =
            expiry.getTime() - now.getTime();

          const days =
            diff / (1000 * 60 * 60 * 24);

          return days <= 7 && days > 0;
        }) || [];

      // =========================
      // UPLOADS LEFT
      // =========================
      const uploadsLeft =
        profiles?.map((profile) => {
          const stat = stats?.find(
            (s) => s.user_id === profile.user_id
          );

          const uploadsUsed =
            stat?.uploads_used || 0;

          const bonus =
            (stat?.bonus_uploads || 0) +
            (stat?.streak_bonus_uploads || 0);

          const limits: Record<string, number> = {
            free: 1,
            starter: 10,
            basic: 15,
            pro: 40,
            scholar: 80,
          };

          const limit =
            limits[
              profile.subscription_plan || "free"
            ] || 1;

          return {
            email: profile.email,
            plan: profile.subscription_plan || "free",
            uploadsLeft:
              limit + bonus - uploadsUsed,
          };
        }) || [];

      // =========================
      // TOP REFERRERS
      // =========================
      const refCounts: Record<string, number> = {};

      referrals?.forEach((r: any) => {
        if (!refCounts[r.referrer_id]) {
          refCounts[r.referrer_id] = 0;
        }

        refCounts[r.referrer_id]++;
      });

      const topReferrers = Object.entries(refCounts)
        .map(([userId, count]) => {
          const profile = profiles?.find(
            (p) => p.user_id === userId
          );

          return {
            email: profile?.email || "Unknown",
            count,
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // =========================
      // SAVE
      // =========================
      setAnalytics({
        totalUsers,
        payingUsers,
        revenue,
        referrals: referrals?.length || 0,
        pending: pendingPayments.length,
        failed: failedPayments.length,
        planBreakdown,
        expiringSoon,
        uploadsLeft,
        topReferrers,
        recentPayments: successfulPayments.slice(0, 10),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        navigate("/auth");
        return;
      }

      if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        navigate("/dashboard");
        return;
      }

      fetchAnalytics();
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-5">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          Testio Admin Dashboard
        </h1>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <Card
            title="Total Users"
            value={analytics.totalUsers}
            icon={<Users />}
          />

          <Card
            title="Paying Users"
            value={analytics.payingUsers}
            icon={<Crown />}
          />

          <Card
            title="Revenue"
            value={`₦${analytics.revenue.toLocaleString()}`}
            icon={<DollarSign />}
          />

          <Card
            title="Referrals"
            value={analytics.referrals}
            icon={<Gift />}
          />

          <Card
            title="Pending"
            value={analytics.pending}
            icon={<Clock />}
          />

          <Card
            title="Failed"
            value={analytics.failed}
            icon={<AlertCircle />}
          />
        </div>

        {/* PLAN BREAKDOWN */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Plans Breakdown
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(analytics.planBreakdown).map(
              ([plan, count]) => (
                <div
                  key={plan}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
                >
                  <p className="text-zinc-400 capitalize">
                    {plan}
                  </p>

                  <h3 className="text-4xl font-bold mt-2">
                    {count}
                  </h3>
                </div>
              )
            )}
          </div>
        </section>

        {/* EXPIRING */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Expiring Within 7 Days
          </h2>

          <div className="overflow-auto rounded-2xl border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">Expires</th>
                </tr>
              </thead>

              <tbody>
                {analytics.expiringSoon.length === 0 ? (
                  <tr>
                    <td className="p-4 text-zinc-400">
                      No subscriptions expiring soon
                    </td>
                  </tr>
                ) : (
                  analytics.expiringSoon.map((user, i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-800"
                    >
                      <td className="p-4">{user.email}</td>

                      <td className="p-4 capitalize">
                        {user.subscription_plan}
                      </td>

                      <td className="p-4">
                        {new Date(
                          user.subscription_expires_at
                        ).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* UPLOADS LEFT */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Users Uploads Left
          </h2>

          <div className="overflow-auto rounded-2xl border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">
                    Uploads Left
                  </th>
                </tr>
              </thead>

              <tbody>
                {analytics.uploadsLeft.map((u, i) => (
                  <tr
                    key={i}
                    className="border-t border-zinc-800"
                  >
                    <td className="p-4">{u.email}</td>

                    <td className="p-4 capitalize">
                      {u.plan}
                    </td>

                    <td className="p-4">
                      {u.uploadsLeft}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* TOP REFERRERS */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top Referrers
          </h2>

          <div className="overflow-auto rounded-2xl border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">
                    Referrals
                  </th>
                </tr>
              </thead>

              <tbody>
                {analytics.topReferrers.length === 0 ? (
                  <tr>
                    <td className="p-4 text-zinc-400">
                      No referrals yet
                    </td>
                  </tr>
                ) : (
                  analytics.topReferrers.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-800"
                    >
                      <td className="p-4">{r.email}</td>

                      <td className="p-4">{r.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RECENT PAYMENTS */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Payments
          </h2>

          <div className="overflow-auto rounded-2xl border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="text-left p-4">User ID</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {analytics.recentPayments.map((p, i) => (
                  <tr
                    key={i}
                    className="border-t border-zinc-800"
                  >
                    <td className="p-4">
                      {p.user_id}
                    </td>

                    <td className="p-4 capitalize">
                      {p.plan}
                    </td>

                    <td className="p-4">
                      ₦{p.amount_ngn?.toLocaleString()}
                    </td>

                    <td className="p-4 capitalize">
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

const Card = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: any;
  icon: React.ReactNode;
}) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-zinc-400">{title}</p>

        <div className="text-white">{icon}</div>
      </div>

      <h2 className="text-4xl font-bold">{value}</h2>
    </div>
  );
};

export default AdminDashboard;
