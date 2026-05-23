import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DashboardData = {
  totalUsers: number;
  totalUploads: number;
  dailyActiveUsers: number;
  conversions: {
    paidUsers: number;
    rate: number;
  };
};

type PayingUser = {
  email: string;
  subscription_plan: string;
  subscription_expires_at: string;
  is_active: boolean;
};

type ActiveUser = {
  email: string;
  subscription_plan: string;
  uploads_remaining: number;
  uploads_used: number;
};

type ReferralData = {
  totalReferrals: number;
  paidReferrals: number;
  topReferrers: any[];
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [payingUsers, setPayingUsers] = useState<PayingUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      // DASHBOARD
      const { data: dashboardData } = await supabase.functions.invoke(
        "admin-ops",
        {
          body: { action: "dashboard" },
        }
      );

      // PAYING USERS
      const { data: payingData } = await supabase.functions.invoke(
        "admin-ops",
        {
          body: { action: "paying-users" },
        }
      );

      // ACTIVE USERS
      const { data: activeData } = await supabase.functions.invoke(
        "admin-ops",
        {
          body: { action: "active-users" },
        }
      );

      // REFERRALS
      const { data: referralData } = await supabase.functions.invoke(
        "admin-ops",
        {
          body: { action: "referrals" },
        }
      );

      setDashboard(dashboardData);
      setPayingUsers(payingData?.users || []);
      setActiveUsers(activeData?.users || []);
      setReferrals(referralData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-8">
        Admin Dashboard
      </h1>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-2xl p-5">
          <p className="text-zinc-400">Total Users</p>
          <h2 className="text-4xl font-bold mt-2">
            {dashboard?.totalUsers || 0}
          </h2>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-5">
          <p className="text-zinc-400">Paying Users</p>
          <h2 className="text-4xl font-bold mt-2">
            {dashboard?.conversions?.paidUsers || 0}
          </h2>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-5">
          <p className="text-zinc-400">Total Uploads</p>
          <h2 className="text-4xl font-bold mt-2">
            {dashboard?.totalUploads || 0}
          </h2>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-5">
          <p className="text-zinc-400">Daily Active Users</p>
          <h2 className="text-4xl font-bold mt-2">
            {dashboard?.dailyActiveUsers || 0}
          </h2>
        </div>
      </div>

      {/* PAYING USERS */}
      <div className="bg-zinc-900 rounded-2xl p-5 mb-8 overflow-auto">
        <h2 className="text-2xl font-bold mb-4">
          Paying Users
        </h2>

        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-zinc-700">
              <th className="py-3">Email</th>
              <th>Plan</th>
              <th>Expires</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {payingUsers.map((user, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800"
              >
                <td className="py-3">{user.email}</td>

                <td className="capitalize">
                  {user.subscription_plan}
                </td>

                <td>
                  {new Date(
                    user.subscription_expires_at
                  ).toLocaleDateString()}
                </td>

                <td>
                  {user.is_active ? (
                    <span className="text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="text-red-400">
                      Expired
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* USERS UPLOADS */}
      <div className="bg-zinc-900 rounded-2xl p-5 mb-8 overflow-auto">
        <h2 className="text-2xl font-bold mb-4">
          Users Uploads Left
        </h2>

        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-zinc-700">
              <th className="py-3">Email</th>
              <th>Plan</th>
              <th>Used</th>
              <th>Remaining</th>
            </tr>
          </thead>

          <tbody>
            {activeUsers.map((user, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800"
              >
                <td className="py-3">{user.email}</td>

                <td className="capitalize">
                  {user.subscription_plan}
                </td>

                <td>{user.uploads_used}</td>

                <td>{user.uploads_remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REFERRALS */}
      <div className="bg-zinc-900 rounded-2xl p-5">
        <h2 className="text-2xl font-bold mb-4">
          Referrals
        </h2>

        <p className="mb-2">
          Total Referrals:{" "}
          <span className="font-bold">
            {referrals?.totalReferrals || 0}
          </span>
        </p>

        <p className="mb-6">
          Paid Referrals:{" "}
          <span className="font-bold">
            {referrals?.paidReferrals || 0}
          </span>
        </p>

        <h3 className="text-xl font-bold mb-3">
          Top Referrers
        </h3>

        <div className="space-y-3">
          {referrals?.topReferrers?.map((ref, i) => (
            <div
              key={i}
              className="bg-zinc-800 rounded-xl p-4"
            >
              <p>{ref.email}</p>

              <p className="text-sm text-zinc-400">
                Total Referrals: {ref.total}
              </p>

              <p className="text-sm text-zinc-400">
                Paid Referrals: {ref.paid}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
