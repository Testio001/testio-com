import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Row = { email: string | null; platform: string; first_installed_at: string; last_seen_at: string };
type Data = { total: number; last24h: number; last7d: number; byPlatform: Record<string, number>; users: Row[] };

export default function AdminPwaInstalls() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("admin-ops", { body: { action: "pwa-installs" } }).then(({ data, error }) => {
      if (error || data?.error) setError(true);
      else setData(data);
    });
  }, []);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-8 overflow-auto">
      <h2 className="text-2xl font-bold mb-4">PWA Installs</h2>
      {error && <p className="text-muted-foreground">Could not load installs. Make sure the database update has been applied.</p>}
      {!data && !error && <p className="text-muted-foreground">Loading...</p>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[["Total", data.total], ["Last 24h", data.last24h], ["Last 7 days", data.last7d]].map(([l, v]) => (
              <div key={l as string} className="bg-secondary rounded-xl p-3">
                <p className="text-muted-foreground text-xs">{l}</p>
                <p className="text-2xl font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(data.byPlatform).map(([p, c]) => (
              <span key={p} className="bg-secondary rounded-full px-3 py-1 text-sm capitalize">{p}: {c}</span>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2">Email</th><th>Device</th><th>Installed</th><th>Last opened</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 break-all">{u.email || "—"}</td>
                  <td className="capitalize">{u.platform}</td>
                  <td>{new Date(u.first_installed_at).toLocaleDateString()}</td>
                  <td>{new Date(u.last_seen_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
