import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Rev = {
  ngn: { total: number; last30d: number; payments: number };
  usd: { total: number; last30d: number; payments: number; available: boolean };
};

export default function AdminRevenue() {
  const [data, setData] = useState<Rev | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("admin-ops", { body: { action: "revenue" } }).then(({ data, error }) => {
      if (error || data?.error) setError(true); else setData(data);
    });
  }, []);

  const card = (label: string, value: string, sub: string) => (
    <div className="bg-secondary rounded-xl p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-bold mt-1 break-all">{value}</p>
      <p className="text-muted-foreground text-xs mt-1">{sub}</p>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-8">
      <h2 className="text-2xl font-bold mb-4">Total Revenue</h2>
      {error && <p className="text-muted-foreground">Could not load revenue.</p>}
      {!data && !error && <p className="text-muted-foreground">Loading...</p>}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {card("Naira (Korapay) — all time", `₦${data.ngn.total.toLocaleString()}`, `${data.ngn.payments} payments · ₦${data.ngn.last30d.toLocaleString()} last 30 days`)}
          {card("Dollars (Lemon Squeezy) — all time",
            data.usd.available ? `$${data.usd.total.toLocaleString()}` : "Unavailable",
            data.usd.available ? `${data.usd.payments} payments · $${data.usd.last30d.toLocaleString()} last 30 days` : "Lemon Squeezy key missing or not reachable")}
        </div>
      )}
    </div>
  );
}
