import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

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

        if (eventName === "order_created" || eventName === "subscription_created") {
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

          console.log(`Activated ${finalPlan} for user ${userId}`);
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
        .select("subscription_plan, subscription_expires_at")
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
