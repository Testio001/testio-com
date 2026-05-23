import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Crown,
  DollarSign,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Gift,
} from "lucide-react";

const ADMIN_EMAIL = "Thetechworld105@gmail.com";

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  starter: 10,
  basic: 15,
  pro: 40,
  scholar: 80,
};

const AdminDashboard = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    payingUsers: 0,
    totalRevenue: 0,
    totalReferrals: 0,
    pendingPayments: 0,
    failedPayments: 0,
  });

  const [plans, setPlans] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [topReferrers, setTopReferrers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;

    fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // TOTAL USERS
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // PAYING USERS
      const { count: payingUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("subscription_plan", "free");

      // PLAN BREAKDOWN
      const { data: planData } = await supabase
        .from("profiles")
        .select("subscription_plan");

      const groupedPlans: any = {};

      planData?.forEach((p: any) => {
        const plan = p.subscription_plan || "free";
        groupedPlans[plan] = (groupedPlans[plan] || 0) + 1;
      });

      const plansArray = Object.entries(groupedPlans).map(([name, total]) => ({
        name,
        total,
      }));

      setPlans(plansArray);

      // EXPIRING SOON
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

      const { data: expiringData } = await supabase
        .from("profiles")
        .select("email, subscription_plan, subscription_expires_at")
        .neq("subscription_plan", "free")
        .lte(
          "subscription_expires_at",
          sevenDaysLater.toISOString()
        )
        .order("subscription_expires_at", { ascending: true });

      setExpiring(expiringData || []);

      // USER UPLOADS
      const { data: uploadsData } = await supabase
        .from("profiles")
        .select(`
          email,
          subscription_plan,
          user_stats (
            uploads_used,
            bonus_uploads,
            streak_bonus_uploads
          )
        `);

      const mappedUsers =
        uploadsData?.map((u: any) => {
          const stats = u.user_stats?.[0];

          const limit =
            PLAN_LIMITS[u.subscription_plan || "free"] || 1;

          const uploadsUsed = stats?.uploads_used || 0;
          const bonus = stats?.bonus_uploads || 0;
          const streak = stats?.streak_bonus_uploads || 0;

          const uploadsLeft =
            limit - uploadsUsed + bonus + streak;

          return {
            email: u.email,
            plan: u.subscription_plan,
            uploadsLeft,
          };
        }) || [];

      setUsers(mappedUsers);

      // TOTAL REFERRALS
      const { count: totalReferrals } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true });

      // TOP REFERRERS
      const { data: refData } = await supabase
        .from("referrals")
        .select("referrer_user_id");

      const groupedRef: any = {};

      refData?.forEach((r: any) => {
        groupedRef[r.referrer_user_id] =
          (groupedRef[r.referrer_user_id] || 0) + 1;
      });

      const topRefs = Object.entries(groupedRef)
        .map(([user, total]) => ({
          user,
          total,
        }))
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 10);

      setTopReferrers(topRefs);

      // PAYMENTS
      const { data: paymentData } = await supabase
        .from("korapay_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      const successful =
        paymentData?.filter((p: any) => p.status === "success") || [];

      const pending =
        paymentData?.filter((p: any) => p.status === "pending") || [];

      const failed =
        paymentData?.filter((p: any) => p.status === "failed") || [];

      const totalRevenue = successful.reduce(
        (acc: number, curr: any) => acc + (curr.amount_ngn || 0),
        0
      );

      setRecentPayments(paymentData?.slice(0, 20) || []);

      setStats({
        totalUsers: totalUsers || 0,
        payingUsers: payingUsers || 0,
        totalRevenue,
        totalReferrals: totalReferrals || 0,
        pendingPayments: pending.length,
        failedPayments: failed.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Testio Admin Dashboard
          </h1>

          <p className="text-muted-foreground mt-2">
            Private analytics dashboard
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            Loading analytics...
          </div>
        ) : (
          <>
            {/* TOP STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">

              <Card
                title="Total Users"
                value={stats.totalUsers}
                icon={<Users className="w-5 h-5" />}
              />

              <Card
                title="Paying Users"
                value={stats.payingUsers}
                icon={<Crown className="w-5 h-5" />}
              />

              <Card
                title="Revenue"
                value={`₦${stats.totalRevenue.toLocaleString()}`}
                icon={<DollarSign className="w-5 h-5" />}
              />

              <Card
                title="Referrals"
                value={stats.totalReferrals}
                icon={<Gift className="w-5 h-5" />}
              />

              <Card
                title="Pending"
                value={stats.pendingPayments}
                icon={<Clock className="w-5 h-5" />}
              />

              <Card
                title="Failed"
                value={stats.failedPayments}
                icon={<AlertCircle className="w-5 h-5" />}
              />
            </div>

            {/* PLAN BREAKDOWN */}
            <Section title="Plans Breakdown">

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    className="bg-card border border-border rounded-xl p-5"
                  >
                    <h3 className="text-muted-foreground text-sm capitalize">
                      {plan.name}
                    </h3>

                    <p className="text-2xl font-bold mt-2">
                      {plan.total}
                    </p>
                  </div>
                ))}

              </div>

            </Section>

            {/* EXPIRING */}
            <Section title="Expiring Within 7 Days">

              <div className="space-y-3">

                {expiring.length === 0 && (
                  <p className="text-muted-foreground">
                    No subscriptions expiring soon.
                  </p>
                )}

                {expiring.map((u, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl p-4 flex justify-between"
                  >
                    <div>
                      <p className="font-medium">{u.email}</p>

                      <p className="text-sm text-muted-foreground capitalize">
                        {u.subscription_plan}
                      </p>
                    </div>

                    <div className="text-sm">
                      {new Date(
                        u.subscription_expires_at
                      ).toLocaleDateString()}
                    </div>
                  </div>
                ))}

              </div>

            </Section>

            {/* USERS */}
            <Section title="Users Uploads Left">

              <div className="overflow-auto">

                <table className="w-full text-sm">

                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3">Email</th>
                      <th className="text-left py-3">Plan</th>
                      <th className="text-left py-3">Uploads Left</th>
                    </tr>
                  </thead>

                  <tbody>

                    {users.map((u, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50"
                      >
                        <td className="py-3">{u.email}</td>

                        <td className="py-3 capitalize">
                          {u.plan}
                        </td>

                        <td className="py-3">
                          {u.uploadsLeft}
                        </td>
                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>

            </Section>

            {/* TOP REFERRERS */}
            <Section title="Top Referrers">

              <div className="space-y-3">

                {topReferrers.map((r, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl p-4 flex justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {r.user}
                      </p>
                    </div>

                    <div className="font-bold">
                      {r.total} referrals
                    </div>
                  </div>
                ))}

              </div>

            </Section>

            {/* RECENT PAYMENTS */}
            <Section title="Recent Payments">

              <div className="space-y-3">

                {recentPayments.map((p, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl p-4 flex justify-between"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {p.plan}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {p.reference}
                      </p>
                    </div>

                    <div className="text-right">

                      <p className="font-bold">
                        ₦{p.amount_ngn?.toLocaleString()}
                      </p>

                      <div
                        className={`text-xs mt-1 ${
                          p.status === "success"
                            ? "text-green-500"
                            : p.status === "pending"
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {p.status}
                      </div>

                    </div>
                  </div>
                ))}

              </div>

            </Section>
          </>
        )}
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
}) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="text-muted-foreground text-sm">
        {title}
      </div>

      {icon}
    </div>

    <div className="text-2xl font-bold">
      {value}
    </div>
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-10">
    <div className="flex items-center gap-2 mb-4">
      <TrendingUp className="w-5 h-5" />

      <h2 className="text-xl font-bold">
        {title}
      </h2>
    </div>

    {children}
  </div>
);

export default AdminDashboard;
