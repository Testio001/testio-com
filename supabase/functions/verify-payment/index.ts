import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redeemPendingReferralOnUpgrade } from "../_shared/redeem-referral.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

const VARIANT_TO_PLAN: Record<number, string> = {
  1504464: "basic",
  1504491: "pro",
  1537626: "scholar",
  1519137: "podcast_addon",
};

/** Statuses that must never extend access. */
const NON_GRANTING = ["past_due", "unpaid", "expired", "paused"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Constant-time-ish hex compare with length guard (Deno-native, no node:crypto). */
async function verifySignature(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const digest = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (digest.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Every profile write goes through here so failures are logged, never silent. */
async function updateProfile(admin: any, userId: string, patch: Record<string, unknown>, label: string) {
  const { error } = await admin.from("profiles").update(patch).eq("user_id", userId);
  if (error) {
    console.error(`profiles update failed (${label}) for ${userId}:`, error.message, patch);
    return false;
  }
  console.log(`profiles updated (${label}) for ${userId}:`, JSON.stringify(patch));
  return true;
}

async function resetQuota(admin: any, userId: string) {
  const { error } = await admin.from("user_stats").update({
    uploads_used: 0,
    bonus_uploads: 0,
    streak_bonus_uploads: 0,
  }).eq("user_id", userId);
  if (error) console.error(`user_stats reset failed for ${userId}:`, error.message);
}

async function addBonusPodcasts(admin: any, userId: string, amount = 5) {
  const { data: stats, error: readErr } = await admin
    .from("user_stats").select("bonus_podcasts").eq("user_id", userId).maybeSingle();
  if (readErr) console.error(`user_stats read failed for ${userId}:`, readErr.message);
  const current = (stats as any)?.bonus_podcasts ?? 0;
  const { error } = await admin.from("user_stats")
    .update({ bonus_podcasts: current + amount }).eq("user_id", userId);
  if (error) console.error(`bonus_podcasts update failed for ${userId}:`, error.message);
  else console.log(`Added ${amount} bonus podcasts for ${userId}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const signature = req.headers.get("x-signature");
    const rawBody = await req.text();

    // ---------------------------------------------------------------- WEBHOOK
    if (signature) {
      const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
      if (!webhookSecret) {
        console.error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
        return json({ error: "Not configured" }, 500);
      }
      if (!(await verifySignature(rawBody, signature, webhookSecret))) {
        console.error("Invalid webhook signature");
        return json({ error: "Invalid signature" }, 401);
      }

      const payload = JSON.parse(rawBody);
      const eventName = payload.meta?.event_name;
      const customData = payload.meta?.custom_data || {};
      const attrs = payload.data?.attributes || {};

      const subEvents = [
        "subscription_created",
        "subscription_updated",
        "subscription_cancelled",
        "subscription_resumed",
        "subscription_expired",
        "subscription_payment_failed",
      ];
      if (eventName !== "order_created" && !subEvents.includes(eventName)) {
        return json({ ok: true, ignored: eventName });
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Resolve the user: custom_data first, then fall back to the buyer email
      // so subscription_updated events without custom_data still land.
      let userId: string | undefined = customData.user_id;
      const buyerEmail: string | undefined = attrs.user_email || payload.data?.attributes?.user_email;
      if (!userId && buyerEmail) {
        const { data: prof } = await admin
          .from("profiles").select("user_id").ilike("email", buyerEmail).maybeSingle();
        userId = (prof as any)?.user_id;
        if (userId) console.log(`Resolved user ${userId} by email ${buyerEmail}`);
      }
      if (!userId) {
        console.error(`No user resolved for ${eventName} (email=${buyerEmail ?? "n/a"})`);
        return json({ ok: true, unresolved: true });
      }

      const plan: string | undefined = customData.plan;
      const subStatus: string | undefined = attrs.status;

      // ---- Subscription lifecycle (incl. native Lemon Squeezy free trials) ----
      if (subEvents.includes(eventName) && subStatus) {
        const variantIdSub = attrs.variant_id || attrs.first_subscription_item?.variant_id;
        const subPlan = plan || (variantIdSub ? VARIANT_TO_PLAN[variantIdSub] : null) || "pro";

        if (subStatus === "on_trial") {
          const trialEndsAt = attrs.trial_ends_at || attrs.renews_at || null;
          await updateProfile(admin, userId, {
            subscription_plan: subPlan,
            subscription_expires_at: trialEndsAt,
            trial_ends_at: trialEndsAt,
          }, "trial started");
          await resetQuota(admin, userId);
          return json({ ok: true, status: subStatus, until: trialEndsAt });
        }

        if (subStatus === "active") {
          const expires = attrs.renews_at || new Date(Date.now() + 30 * 864e5).toISOString();
          await updateProfile(admin, userId, {
            subscription_plan: subPlan,
            subscription_expires_at: expires,
            trial_ends_at: null,
          }, "subscription active");
          await redeemPendingReferralOnUpgrade(admin, userId, subPlan);
          return json({ ok: true, status: subStatus, until: expires });
        }

        // Dunning / paused / unpaid / expired: NEVER extend access. Keep the plan
        // only while an already-paid (or trial) window is still in the future.
        if (NON_GRANTING.includes(subStatus) || eventName === "subscription_payment_failed") {
          const renews = attrs.renews_at ? new Date(attrs.renews_at).getTime() : 0;
          const trialEnd = attrs.trial_ends_at ? new Date(attrs.trial_ends_at).getTime() : 0;
          const endsAt = attrs.ends_at ? new Date(attrs.ends_at).getTime() : 0;
          const paidUntil = Math.max(renews, trialEnd, endsAt);
          const hardDowngrade = subStatus === "unpaid" || subStatus === "expired";

          if (!hardDowngrade && paidUntil > Date.now()) {
            await updateProfile(admin, userId, {
              subscription_plan: subPlan,
              subscription_expires_at: new Date(paidUntil).toISOString(),
              trial_ends_at: null,
            }, `${subStatus} within paid window`);
          } else {
            await updateProfile(admin, userId, {
              subscription_plan: "free",
              subscription_expires_at: paidUntil ? new Date(paidUntil).toISOString() : new Date().toISOString(),
              trial_ends_at: null,
            }, `downgraded (${subStatus}, payment never succeeded)`);
          }
          return json({ ok: true, status: subStatus });
        }

        if (subStatus === "cancelled") {
          const endsAtRaw = attrs.ends_at || attrs.renews_at || attrs.trial_ends_at || null;
          const stillHasAccess = endsAtRaw ? new Date(endsAtRaw).getTime() > Date.now() : false;
          if (stillHasAccess) {
            // Cancelled but still inside a window they already paid for / trial.
            await updateProfile(admin, userId, {
              subscription_expires_at: endsAtRaw,
            }, "cancelled, access kept");
          } else {
            await updateProfile(admin, userId, {
              subscription_plan: "free",
              subscription_expires_at: endsAtRaw ?? new Date().toISOString(),
              trial_ends_at: null,
            }, "downgraded (cancelled, window over)");
          }
          return json({ ok: true, status: subStatus });
        }

        // Unknown future status: log, change nothing.
        console.log(`Unhandled subscription status "${subStatus}" for ${userId} — no change`);
        return json({ ok: true, status: subStatus, unhandled: true });
      }

      // ---- One-off order (order_created) ----
      const variantId = attrs.first_order_item?.variant_id || attrs.variant_id;
      const finalPlan = plan || (variantId ? VARIANT_TO_PLAN[variantId] : null) || "basic";

      if (finalPlan === "podcast_addon") {
        await addBonusPodcasts(admin, userId, 5);
        return json({ ok: true, addon: true });
      }

      // A one-off order for a subscription plan: give exactly 30 days. If a
      // subscription event follows, its renews_at overrides this.
      const expiresAt = new Date(Date.now() + 30 * 864e5).toISOString();
      await updateProfile(admin, userId, {
        subscription_plan: finalPlan,
        subscription_expires_at: expiresAt,
        trial_ends_at: null,
      }, "order_created");
      await resetQuota(admin, userId);
      await redeemPendingReferralOnUpgrade(admin, userId, finalPlan);
      return json({ ok: true, plan: finalPlan, until: expiresAt });
    }

    // ------------------------------------------- MANUAL VERIFY (from frontend)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("email, subscription_plan, subscription_expires_at, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile && profile.subscription_plan !== "free" && profile.subscription_expires_at) {
      if (new Date(profile.subscription_expires_at) > new Date()) {
        return json({
          success: true,
          plan: profile.subscription_plan,
          expires_at: profile.subscription_expires_at,
          trial_ends_at: (profile as any).trial_ends_at ?? null,
        });
      }
    }

    // FALLBACK: webhook may have been missed. Check live Lemon Squeezy state.
    const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    const email = profile?.email || user.email;
    if (lsKey && email) {
      const lsHeaders = { Accept: "application/vnd.api+json", Authorization: `Bearer ${lsKey}` };

      // 1) Subscriptions first — this is the source of truth for recurring plans
      //    and prevents a stale paid order from re-granting access after dunning.
      try {
        const subRes = await fetch(
          `https://api.lemonsqueezy.com/v1/subscriptions?filter[user_email]=${encodeURIComponent(email)}&page[size]=20`,
          { headers: lsHeaders },
        );
        if (subRes.ok) {
          const subJson = await subRes.json();
          const subs: any[] = Array.isArray(subJson?.data) ? subJson.data : [];
          const granting = subs.find((s) => ["active", "on_trial"].includes(s.attributes?.status));
          if (granting) {
            const a = granting.attributes || {};
            const variant = a.variant_id || a.first_subscription_item?.variant_id;
            const p = (variant ? VARIANT_TO_PLAN[variant] : null) || "pro";
            const until = a.status === "on_trial" ? (a.trial_ends_at || a.renews_at) : a.renews_at;
            if (until) {
              await updateProfile(admin, user.id, {
                subscription_plan: p,
                subscription_expires_at: until,
                trial_ends_at: a.status === "on_trial" ? until : null,
              }, `manual verify (${a.status})`);
              await redeemPendingReferralOnUpgrade(admin, user.id, p);
              return json({ success: true, plan: p, expires_at: until, status: a.status });
            }
          }
          if (subs.length > 0) {
            // Subscriptions exist but none grant access → genuinely not paid.
            return json({ success: false, message: "Your subscription is not active. Please check your payment method." });
          }
        }
      } catch (e) {
        console.error("Lemon Squeezy subscriptions lookup failed:", e);
      }

      // 2) No subscription at all → look for a recent one-off paid order.
      try {
        const lsRes = await fetch(
          `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(email)}&sort=-created_at&page[size]=5`,
          { headers: lsHeaders },
        );
        const lsJson = await lsRes.json();
        const orders = Array.isArray(lsJson?.data) ? lsJson.data : [];
        const since = Date.now() - 90 * 864e5;
        const paid = orders.find((o: any) => {
          const a = o?.attributes || {};
          const created = a.created_at ? new Date(a.created_at).getTime() : 0;
          return a.status === "paid" && created >= since;
        });
        if (paid) {
          const a = paid.attributes || {};
          const matchedPlan = a.first_order_item?.variant_id
            ? VARIANT_TO_PLAN[a.first_order_item.variant_id]
            : null;

          if (matchedPlan === "podcast_addon") {
            await addBonusPodcasts(admin, user.id, 5);
            return json({ success: true, plan: "podcast_addon", addon: true });
          }
          if (matchedPlan) {
            const expires = new Date(Date.now() + 30 * 864e5).toISOString();
            await updateProfile(admin, user.id, {
              subscription_plan: matchedPlan,
              subscription_expires_at: expires,
              trial_ends_at: null,
            }, `manual verify (order ${paid.id})`);
            await resetQuota(admin, user.id);
            await redeemPendingReferralOnUpgrade(admin, user.id, matchedPlan);
            return json({ success: true, plan: matchedPlan, expires_at: expires });
          }
        }
      } catch (e) {
        console.error("Lemon Squeezy orders fallback failed:", e);
      }
    }

    return json({ success: false, message: "Subscription not yet active. It may take a moment to process." });
  } catch (err) {
    console.error("verify-payment error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
