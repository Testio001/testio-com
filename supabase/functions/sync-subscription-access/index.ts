import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LS_HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  Accept: "application/vnd.api+json",
});

/** Statuses that legitimately grant access right now. */
const GRANTING = ["active", "on_trial"];

/**
 * Safety net for billing drift: re-checks every paying profile against the real
 * Lemon Squeezy subscription status and downgrades anyone whose subscription is
 * not actually paid (failed renewal / dunning / expired trial).
 *
 * Call with { dryRun: true } to preview, { email: "x@y.com" } for one user.
 * Meant to be run by cron once a day, or manually by an admin.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    if (!lsKey) return json({ error: "LEMONSQUEEZY_API_KEY not configured" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: service-role / cron bearer token, or an authenticated admin user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let authorized = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorized && token) {
      const { data: { user } } = await admin.auth.getUser(token);
      if (user) {
        const { data: role } = await admin
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        authorized = !!role;
      }
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const onlyEmail: string | undefined = body.email;

    let q = admin
      .from("profiles")
      .select("user_id, email, subscription_plan, subscription_expires_at, trial_ends_at")
      .neq("subscription_plan", "free");
    if (onlyEmail) q = q.ilike("email", onlyEmail);

    const { data: profiles, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results: any[] = [];

    for (const p of profiles ?? []) {
      if (!p.email) continue;

      const res = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions?filter[user_email]=${encodeURIComponent(p.email)}&page[size]=20`,
        { headers: LS_HEADERS(lsKey) },
      );
      if (!res.ok) {
        results.push({ email: p.email, action: "skipped", reason: `LS ${res.status}` });
        continue;
      }
      const data = await res.json();
      const subs: any[] = Array.isArray(data.data) ? data.data : [];

      // No recurring subscription at all → this is a one-off (e.g. Korapay/NGN);
      // let its own expiry date govern, only downgrade once it has passed.
      if (subs.length === 0) {
        const exp = p.subscription_expires_at ? new Date(p.subscription_expires_at).getTime() : 0;
        if (exp && exp < Date.now()) {
          if (!dryRun) {
            await admin.from("profiles")
              .update({ subscription_plan: "free", trial_ends_at: null })
              .eq("user_id", p.user_id);
          }
          results.push({ email: p.email, action: "downgraded", reason: "one-off purchase expired" });
        } else {
          results.push({ email: p.email, action: "kept", reason: "no LS subscription, not expired" });
        }
        continue;
      }

      const granting = subs.find((s) => GRANTING.includes(s.attributes?.status));

      if (granting) {
        const a = granting.attributes ?? {};
        const until = a.status === "on_trial"
          ? (a.trial_ends_at || a.renews_at || null)
          : (a.renews_at || null);
        if (!dryRun && until) {
          await admin.from("profiles").update({
            subscription_expires_at: until,
            trial_ends_at: a.status === "on_trial" ? until : null,
          }).eq("user_id", p.user_id);
        }
        results.push({ email: p.email, action: "kept", status: a.status, until });
        continue;
      }

      // Every subscription is past_due / unpaid / cancelled-and-over / expired.
      const latest = subs
        .slice()
        .sort((x, y) =>
          new Date(y.attributes?.updated_at ?? 0).getTime() - new Date(x.attributes?.updated_at ?? 0).getTime())[0];
      const la = latest?.attributes ?? {};
      const endsAt = la.ends_at || la.renews_at || la.trial_ends_at || null;
      const stillInPaidWindow = endsAt && new Date(endsAt).getTime() > Date.now() && la.status === "cancelled";

      if (stillInPaidWindow) {
        results.push({ email: p.email, action: "kept", status: la.status, until: endsAt });
        continue;
      }

      if (!dryRun) {
        await admin.from("profiles").update({
          subscription_plan: "free",
          subscription_expires_at: endsAt ?? new Date().toISOString(),
          trial_ends_at: null,
        }).eq("user_id", p.user_id);
      }
      results.push({ email: p.email, action: "downgraded", status: la.status, endsAt });
    }

    const downgraded = results.filter((r) => r.action === "downgraded").length;
    console.log(`sync-subscription-access: checked ${results.length}, downgraded ${downgraded}, dryRun=${dryRun}`);
    return json({ ok: true, dryRun, checked: results.length, downgraded, results });
  } catch (err) {
    console.error("sync-subscription-access error", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
