import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const signature = req.headers.get("x-signature");
      const rawBody = await req.text();

      if (signature) {
        const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
        if (!webhookSecret) {
          console.error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
          return new Response(JSON.stringify({ error: "Not configured" }), { status: 500, headers: corsHeaders });
        }

        const hmac = createHmac("sha256", webhookSecret);
        hmac.update(rawBody);
        const digest = hmac.digest("hex");

        if (digest !== signature) {
          console.error("Invalid webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
        }

        const payload = JSON.parse(rawBody);
        const eventName = payload.meta?.event_name;

        const subEvents = [
          "subscription_created",
          "subscription_updated",
          "subscription_cancelled",
          "subscription_resumed",
          "subscription_expired",
        ];

        if (eventName === "order_created" || subEvents.includes(eventName)) {
          const customData = payload.meta?.custom_data || {};
          const userId = customData.user_id;
          const plan = customData.plan;

          if (!userId) {
            console.error("No user_id in custom data");
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
          }

          const adminClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          const attrs = payload.data?.attributes || {};
          const subStatus: string | undefined = attrs.status;

          // ---- Subscription lifecycle (incl. native LemonSqueezy free trials) ----
          if (subEvents.includes(eventName) && subStatus) {
            const variantIdSub = attrs.variant_id || attrs.first_subscription_item?.variant_id;
            const subPlan = plan || (variantIdSub ? VARIANT_TO_PLAN[variantIdSub] : null) || "pro";

            if (subStatus === "on_trial") {
              const trialEndsAt = attrs.trial_ends_at || attrs.renews_at || null;
              await adminClient.from("profiles").update({
                subscription_plan: subPlan,
                subscription_expires_at: trialEndsAt,
                trial_ends_at: trialEndsAt,
              }).eq("user_id", userId);
              await adminClient.from("user_stats").update({
                uploads_used: 0,
                bonus_uploads: 0,
                streak_bonus_uploads: 0,
              }).eq("user_id", userId);
              console.log(`Trial started: ${subPlan} for ${userId} until ${trialEndsAt}`);
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }

            // Only a genuinely paid, active subscription grants/extends access.
            if (subStatus === "active") {
              const renews = attrs.renews_at || null;
              const expires = renews || new Date(Date.now() + 30 * 864e5).toISOString();
              await adminClient.from("profiles").update({
                subscription_plan: subPlan,
                subscription_expires_at: expires,
                trial_ends_at: null,
              }).eq("user_id", userId);
              await redeemPendingReferralOnUpgrade(adminClient, userId, subPlan);
              console.log(`Subscription active: ${subPlan} for ${userId} until ${expires}`);
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }

            // Failed payment (dunning) or paused: NEVER extend access. Keep it only
            // while the already-paid/trial window is still in the future.
            if (subStatus === "past_due" || subStatus === "paused") {
              const renews = attrs.renews_at ? new Date(attrs.renews_at).getTime() : 0;
              const trialEnd = attrs.trial_ends_at ? new Date(attrs.trial_ends_at).getTime() : 0;
              const paidUntil = Math.max(renews, trialEnd);
              if (paidUntil > Date.now()) {
                await adminClient.from("profiles").update({
                  subscription_plan: subPlan,
                  subscription_expires_at: new Date(paidUntil).toISOString(),
                }).eq("user_id", userId);
                console.log(`Subscription ${subStatus}: ${subPlan} for ${userId} kept until ${new Date(paidUntil).toISOString()}`);
              } else {
                await adminClient.from("profiles").update({
                  subscription_plan: "free",
                  subscription_expires_at: paidUntil ? new Date(paidUntil).toISOString() : new Date().toISOString(),
                  trial_ends_at: null,
                }).eq("user_id", userId);
                console.log(`Downgraded ${userId} to free (${subStatus}, payment never succeeded)`);
              }
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }


            if (subStatus === "cancelled" || subStatus === "expired" || subStatus === "unpaid") {
              const endsAt = attrs.ends_at || attrs.trial_ends_at || null;
              const stillHasAccess = endsAt ? new Date(endsAt).getTime() > Date.now() : false;
              if (subStatus === "expired" || subStatus === "unpaid" || !stillHasAccess) {
                // Trial ended without converting, or paid period is over → back to Free
                await adminClient.from("profiles").update({
                  subscription_plan: "free",
                  subscription_expires_at: endsAt,
                }).eq("user_id", userId);
                console.log(`Downgraded ${userId} to free (${subStatus})`);
              } else {
                // Cancelled but still inside trial/paid window → keep access until endsAt
                await adminClient.from("profiles").update({
                  subscription_expires_at: endsAt,
                }).eq("user_id", userId);
                console.log(`Cancelled ${userId}, access kept until ${endsAt}`);
              }
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }
          }

          // Handle podcast addon purchase
          if (plan === "podcast_addon") {
            // Add 5 bonus podcasts to user_stats
            const { data: stats } = await adminClient
              .from("user_stats")
              .select("bonus_podcasts")
              .eq("user_id", userId)
              .single();

            const currentBonus = (stats as any)?.bonus_podcasts ?? 0;
            await adminClient
              .from("user_stats")
              .update({ bonus_podcasts: currentBonus + 5 })
              .eq("user_id", userId);

            console.log(`Added 5 bonus podcasts for user ${userId}`);
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
          }

          // Handle subscription purchase
          const variantId = payload.data?.attributes?.first_order_item?.variant_id
            || payload.data?.attributes?.variant_id;
          const finalPlan = plan || (variantId ? VARIANT_TO_PLAN[variantId] : null) || "basic";

          // Skip if it's a podcast addon variant
          if (finalPlan === "podcast_addon") {
            const { data: stats } = await adminClient
              .from("user_stats")
              .select("bonus_podcasts")
              .eq("user_id", userId)
              .single();

            const currentBonus = (stats as any)?.bonus_podcasts ?? 0;
            await adminClient
              .from("user_stats")
              .update({ bonus_podcasts: currentBonus + 5 })
              .eq("user_id", userId);

            console.log(`Added 5 bonus podcasts for user ${userId} (variant match)`);
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
          }

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await adminClient.from("profiles").update({
            subscription_plan: finalPlan,
            subscription_expires_at: expiresAt.toISOString(),
          }).eq("user_id", userId);

          // Reset monthly usage and clear bonus uploads so the user starts the
          // new plan with exactly their plan quota (no leftover bonuses).
          await adminClient.from("user_stats").update({
            uploads_used: 0,
            bonus_uploads: 0,
            streak_bonus_uploads: 0,
          }).eq("user_id", userId);

          console.log(`Activated ${finalPlan} for user ${userId}`);
          await redeemPendingReferralOnUpgrade(adminClient, userId, finalPlan);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Manual verification call from frontend
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profile } = await adminClient
        .from("profiles")
        .select("email, subscription_plan, subscription_expires_at")
        .eq("user_id", user.id)
        .single();

      if (profile && profile.subscription_plan !== "free" && profile.subscription_expires_at) {
        const expires = new Date(profile.subscription_expires_at);
        if (expires > new Date()) {
          return new Response(
            JSON.stringify({ success: true, plan: profile.subscription_plan, expires_at: profile.subscription_expires_at }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // FALLBACK: webhook may have been missed. Query Lemon Squeezy API for the
      // user's most recent paid order in the last 24h and credit them directly.
      const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
      const email = profile?.email || user.email;
      if (lsKey && email) {
        try {
          const lsRes = await fetch(
            `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(email)}&sort=-created_at&page[size]=5`,
            {
              headers: {
                Accept: "application/vnd.api+json",
                Authorization: `Bearer ${lsKey}`,
              },
            }
          );
          const lsJson = await lsRes.json();
          const orders = Array.isArray(lsJson?.data) ? lsJson.data : [];
          // Look back 90 days so users who paid days ago but never got credited
          // (missed webhook, network drop) are still recovered on next visit.
          const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
          const paid = orders.find((o: any) => {
            const a = o?.attributes || {};
            const created = a.created_at ? new Date(a.created_at).getTime() : 0;
            return (a.status === "paid") && created >= since;
          });
          if (paid) {
            const a = paid.attributes || {};
            const variantId = a.first_order_item?.variant_id;
            const matchedPlan = variantId ? VARIANT_TO_PLAN[variantId] : null;

            if (matchedPlan === "podcast_addon") {
              const { data: stats } = await adminClient
                .from("user_stats")
                .select("bonus_podcasts")
                .eq("user_id", user.id)
                .single();
              const currentBonus = (stats as any)?.bonus_podcasts ?? 0;
              await adminClient
                .from("user_stats")
                .update({ bonus_podcasts: currentBonus + 5 })
                .eq("user_id", user.id);
              return new Response(
                JSON.stringify({ success: true, plan: "podcast_addon", addon: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            if (matchedPlan) {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              await adminClient.from("profiles").update({
                subscription_plan: matchedPlan,
                subscription_expires_at: expiresAt.toISOString(),
              }).eq("user_id", user.id);
              await adminClient.from("user_stats").update({
                uploads_used: 0,
                bonus_uploads: 0,
                streak_bonus_uploads: 0,
              }).eq("user_id", user.id);
              await redeemPendingReferralOnUpgrade(adminClient, user.id, matchedPlan);
              console.log(`verify-payment fallback: credited ${matchedPlan} to ${user.id} from LS order ${paid.id}`);
              return new Response(
                JSON.stringify({ success: true, plan: matchedPlan, expires_at: expiresAt.toISOString() }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (e) {
          console.error("Lemon Squeezy API fallback failed:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: false, message: "Subscription not yet active. It may take a moment to process." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
