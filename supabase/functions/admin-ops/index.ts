import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LS_VARIANT_TO_PLAN: Record<number, string> = {
  1504464: "basic",
  1504491: "pro",
  1537626: "scholar",
  1519137: "podcast_addon",
};

async function creditPlan(admin: any, userId: string, plan: string) {
  if (plan === "podcast_addon") {
    const { data: stats } = await admin
      .from("user_stats").select("bonus_podcasts").eq("user_id", userId).maybeSingle();
    const cur = stats?.bonus_podcasts ?? 0;
    await admin.from("user_stats").update({ bonus_podcasts: cur + 5 }).eq("user_id", userId);
    return;
  }
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("profiles").update({
    subscription_plan: plan,
    subscription_expires_at: expiresAt,
  }).eq("user_id", userId);
  await admin.from("user_stats").update({
    uploads_used: 0,
    bonus_uploads: 0,
    streak_bonus_uploads: 0,
  }).eq("user_id", userId);
}

type DashboardCounts = {
  totalUsers: number;
  totalUploads: number;
  dailyActiveUsers: number;
  quizzesTotal: number;
  quizzesToday: number;
  flashcardsTotal: number;
  flashcardsToday: number;
  podcastsTotal: number;
  podcastsToday: number;
  paidUsers: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate caller and require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    const { action } = body as { action?: string };

    if (action === "dashboard") {
      const [
        totalUsersRes,
        totalUploadsRes,
        dailyUsersRes,
        quizzesTotalRes,
        quizzesTodayRes,
        flashcardsTotalRes,
        flashcardsTodayRes,
        podcastsTotalRes,
        podcastsTodayRes,
        paidUsersRes,
      ] = await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("ai_usage_log").select("user_id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("flashcard_sets").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("flashcard_sets").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("podcasts").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("podcasts").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).in("subscription_plan", ["basic", "pro", "scholar", "elite"]).gt("subscription_expires_at", new Date().toISOString()),
      ]);

      const errors = [
        totalUsersRes.error,
        totalUploadsRes.error,
        dailyUsersRes.error,
        quizzesTotalRes.error,
        quizzesTodayRes.error,
        flashcardsTotalRes.error,
        flashcardsTodayRes.error,
        podcastsTotalRes.error,
        podcastsTodayRes.error,
        paidUsersRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error("admin-ops dashboard errors", errors);
        return json({ error: "Unable to load dashboard metrics" }, 500);
      }

      const dailyRows = await supabaseAdmin
        .from("ai_usage_log")
        .select("user_id")
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      if (dailyRows.error) {
        console.error("admin-ops daily rows error", dailyRows.error);
        return json({ error: "Unable to load daily active users" }, 500);
      }

      const uniqueDailyUsers = new Set((dailyRows.data ?? []).map((row) => row.user_id)).size;
      const counts: DashboardCounts = {
        totalUsers: totalUsersRes.count ?? 0,
        totalUploads: totalUploadsRes.count ?? 0,
        dailyActiveUsers: uniqueDailyUsers,
        quizzesTotal: quizzesTotalRes.count ?? 0,
        quizzesToday: quizzesTodayRes.count ?? 0,
        flashcardsTotal: flashcardsTotalRes.count ?? 0,
        flashcardsToday: flashcardsTodayRes.count ?? 0,
        podcastsTotal: podcastsTotalRes.count ?? 0,
        podcastsToday: podcastsTodayRes.count ?? 0,
        paidUsers: paidUsersRes.count ?? 0,
      };

      const rate = counts.totalUsers > 0 ? (counts.paidUsers / counts.totalUsers) * 100 : 0;

      return json({
        totalUsers: counts.totalUsers,
        totalUploads: counts.totalUploads,
        dailyActiveUsers: counts.dailyActiveUsers,
        featureUsage: {
          quizzes: { total: counts.quizzesTotal, today: counts.quizzesToday },
          flashcards: { total: counts.flashcardsTotal, today: counts.flashcardsToday },
          podcasts: { total: counts.podcastsTotal, today: counts.podcastsToday },
        },
        conversions: {
          paidUsers: counts.paidUsers,
          rate,
        },
      });
    }

    if (action === "lookup-user") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!email) return json({ error: "Email is required" }, 400);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("admin-ops lookup error", error);
        return json({ error: "Unable to look up user" }, 500);
      }

      if (!data?.user_id) return json(null);

      const { data: stats, error: statsError } = await supabaseAdmin
        .from("user_stats")
        .select("current_streak, longest_streak")
        .eq("user_id", data.user_id)
        .maybeSingle();

      if (statsError) {
        console.error("admin-ops stats lookup error", statsError);
        return json({ error: "Unable to load streak data" }, 500);
      }

      return json({
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
        current_streak: stats?.current_streak ?? 0,
        longest_streak: stats?.longest_streak ?? 0,
      });
    }

    if (action === "set-streak") {
      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
      const streak = Number(body.streak);
      if (!targetUserId || !Number.isInteger(streak) || streak < 0) {
        return json({ error: "Valid target user and streak are required" }, 400);
      }

      const { data: currentStats, error: currentStatsError } = await supabaseAdmin
        .from("user_stats")
        .select("current_streak, longest_streak")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (currentStatsError || !currentStats) {
        console.error("admin-ops current stats error", currentStatsError);
        return json({ error: "User stats not found" }, 404);
      }

      const { error: updateError } = await supabaseAdmin
        .from("user_stats")
        .update({
          current_streak: streak,
          longest_streak: Math.max(currentStats.longest_streak ?? 0, streak),
          last_upload_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId);

      if (updateError) {
        console.error("admin-ops update streak error", updateError);
        return json({ error: "Unable to update streak" }, 500);
      }

      return json({ success: true });
    }

    if (action === "paying-users") {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name, subscription_plan, subscription_expires_at, created_at")
        .in("subscription_plan", ["starter", "basic", "pro", "scholar", "elite"])
        .order("subscription_expires_at", { ascending: false });

      if (error) {
        console.error("admin-ops paying-users error", error);
        return json({ error: "Unable to load paying users" }, 500);
      }

      const now = Date.now();
      const users = (data ?? []).map((u) => ({
        ...u,
        is_active: u.subscription_expires_at ? new Date(u.subscription_expires_at).getTime() > now : false,
      }));

      return json({ users, total: users.length, active: users.filter((u) => u.is_active).length });
    }

    if (action === "active-users") {
      const FREE = 2, STARTER = 10, BASIC = 15, PRO = 40, SCHOLAR = 80, ELITE = 80;
      const limitFor = (plan: string, expires: string | null) => {
        const active = expires && new Date(expires).getTime() > Date.now();
        const p = active ? plan : "free";
        switch (p) {
          case "starter": return STARTER;
          case "basic": return BASIC;
          case "pro": return PRO;
          case "scholar": return SCHOLAR;
          case "elite": return ELITE;
          default: return FREE;
        }
      };

      const { data: stats, error: statsErr } = await supabaseAdmin
        .from("user_stats")
        .select("user_id, uploads_used, bonus_uploads, streak_bonus_uploads")
        .order("uploads_used", { ascending: false })
        .limit(30);

      if (statsErr) {
        console.error("admin-ops active-users stats error", statsErr);
        return json({ error: "Unable to load active users" }, 500);
      }

      const ids = (stats ?? []).map((s) => s.user_id);
      const [profilesRes, visitsRes] = await Promise.all([
        ids.length
          ? supabaseAdmin.from("profiles").select("user_id, email, display_name, subscription_plan, subscription_expires_at").in("user_id", ids)
          : Promise.resolve({ data: [], error: null } as any),
        ids.length
          ? supabaseAdmin.from("user_visits").select("user_id, visit_count, last_visit_at").in("user_id", ids)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const profMap = new Map<string, any>();
      for (const p of profilesRes.data ?? []) profMap.set(p.user_id, p);
      const visitMap = new Map<string, any>();
      for (const v of visitsRes.data ?? []) visitMap.set(v.user_id, v);

      const users = (stats ?? []).map((s) => {
        const p = profMap.get(s.user_id) ?? {};
        const limit = limitFor(p.subscription_plan ?? "free", p.subscription_expires_at ?? null);
        const bonus = (s.bonus_uploads ?? 0) + (s.streak_bonus_uploads ?? 0);
        const totalAllowed = limit + bonus;
        const used = s.uploads_used ?? 0;
        const v = visitMap.get(s.user_id);
        return {
          user_id: s.user_id,
          email: p.email ?? null,
          display_name: p.display_name ?? null,
          subscription_plan: p.subscription_plan ?? "free",
          uploads_used: used,
          uploads_limit: totalAllowed,
          uploads_remaining: Math.max(0, totalAllowed - used),
          visit_count: v?.visit_count ?? 0,
          last_visit_at: v?.last_visit_at ?? null,
        };
      });

      return json({ users });
    }

    if (action === "referrals") {
      // Get all referrals
      const { data: refs, error: refErr } = await supabaseAdmin
        .from("referrals")
        .select("referrer_user_id, referred_user_id, created_at")
        .order("created_at", { ascending: false });

      if (refErr) {
        console.error("admin-ops referrals error", refErr);
        return json({ error: "Unable to load referrals" }, 500);
      }

      const userIds = Array.from(
        new Set((refs ?? []).flatMap((r) => [r.referrer_user_id, r.referred_user_id])),
      );

      const profilesMap = new Map<string, { email: string | null; display_name: string | null; subscription_plan: string; subscription_expires_at: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email, display_name, subscription_plan, subscription_expires_at")
          .in("user_id", userIds);
        for (const p of profs ?? []) {
          profilesMap.set(p.user_id, {
            email: p.email,
            display_name: p.display_name,
            subscription_plan: p.subscription_plan,
            subscription_expires_at: p.subscription_expires_at,
          });
        }
      }

      const nowIso = new Date().toISOString();
      const isPaid = (uid: string) => {
        const p = profilesMap.get(uid);
        if (!p) return false;
        if (!["basic", "pro", "scholar", "elite"].includes(p.subscription_plan)) return false;
        return !!p.subscription_expires_at && p.subscription_expires_at > nowIso;
      };

      const rows = (refs ?? []).map((r) => {
        const referrer = profilesMap.get(r.referrer_user_id);
        const referred = profilesMap.get(r.referred_user_id);
        return {
          created_at: r.created_at,
          referrer_user_id: r.referrer_user_id,
          referrer_email: referrer?.email ?? null,
          referrer_name: referrer?.display_name ?? null,
          referred_user_id: r.referred_user_id,
          referred_email: referred?.email ?? null,
          referred_name: referred?.display_name ?? null,
          referred_plan: referred?.subscription_plan ?? "free",
          referred_is_paid: isPaid(r.referred_user_id),
        };
      });

      // Aggregate by referrer
      const agg = new Map<string, { user_id: string; email: string | null; name: string | null; total: number; paid: number }>();
      for (const row of rows) {
        const cur = agg.get(row.referrer_user_id) ?? {
          user_id: row.referrer_user_id,
          email: row.referrer_email,
          name: row.referrer_name,
          total: 0,
          paid: 0,
        };
        cur.total += 1;
        if (row.referred_is_paid) cur.paid += 1;
        agg.set(row.referrer_user_id, cur);
      }
      const topReferrers = Array.from(agg.values()).sort((a, b) => b.paid - a.paid || b.total - a.total);

      return json({
        totalReferrals: rows.length,
        paidReferrals: rows.filter((r) => r.referred_is_paid).length,
        topReferrers,
        rows: rows.slice(0, 200),
      });
    }

    if (action === "reconcile-payments") {
      const report = {
        korapay: { scanned: 0, credited: 0, failed: 0, details: [] as any[] },
        lemonsqueezy: { scanned: 0, credited: 0, failed: 0, details: [] as any[] },
      };

      // ===== Korapay reconciliation =====
      const koraSecret = Deno.env.get("KORAPAY_SECRET_KEY");
      if (koraSecret) {
        const { data: txs } = await supabaseAdmin
          .from("korapay_transactions")
          .select("reference, user_id, plan, status, created_at")
          .neq("status", "success")
          .order("created_at", { ascending: false })
          .limit(500);
        for (const tx of txs ?? []) {
          report.korapay.scanned += 1;
          try {
            const vRes = await fetch(
              `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(tx.reference)}`,
              { headers: { Authorization: `Bearer ${koraSecret}` } },
            );
            const vJson = await vRes.json();
            if (vRes.ok && vJson?.data?.status === "success") {
              await creditPlan(supabaseAdmin, tx.user_id, tx.plan);
              await supabaseAdmin
                .from("korapay_transactions")
                .update({ status: "success" })
                .eq("reference", tx.reference);
              report.korapay.credited += 1;
              report.korapay.details.push({ reference: tx.reference, user_id: tx.user_id, plan: tx.plan, action: "credited" });
            }
          } catch (e) {
            report.korapay.failed += 1;
            report.korapay.details.push({ reference: tx.reference, error: String(e) });
          }
        }
      }

      // ===== Lemon Squeezy reconciliation =====
      const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
      if (lsKey) {
        // Scan ALL profiles currently on free plan with an email — they may
        // have paid via Lemon Squeezy but never been credited.
        const { data: freeUsers } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email, subscription_plan, subscription_expires_at")
          .or("subscription_plan.eq.free,subscription_expires_at.lt." + new Date().toISOString())
          .not("email", "is", null)
          .limit(1000);

        const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
        for (const u of freeUsers ?? []) {
          report.lemonsqueezy.scanned += 1;
          try {
            const lsRes = await fetch(
              `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(u.email)}&sort=-created_at&page[size]=5`,
              { headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${lsKey}` } },
            );
            const lsJson = await lsRes.json();
            const orders = Array.isArray(lsJson?.data) ? lsJson.data : [];
            const paid = orders.find((o: any) => {
              const a = o?.attributes || {};
              const created = a.created_at ? new Date(a.created_at).getTime() : 0;
              return a.status === "paid" && created >= since;
            });
            if (paid) {
              const a = paid.attributes || {};
              const variantId = a.first_order_item?.variant_id;
              const plan = variantId ? LS_VARIANT_TO_PLAN[variantId] : null;
              if (plan) {
                await creditPlan(supabaseAdmin, u.user_id, plan);
                report.lemonsqueezy.credited += 1;
                report.lemonsqueezy.details.push({ user_id: u.user_id, email: u.email, plan, order_id: paid.id });
              }
            }
          } catch (e) {
            report.lemonsqueezy.failed += 1;
            report.lemonsqueezy.details.push({ user_id: u.user_id, error: String(e) });
          }
        }
      }

      return json(report);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-ops error", error);
    return json({ error: "An internal error occurred" }, 500);
  }
});