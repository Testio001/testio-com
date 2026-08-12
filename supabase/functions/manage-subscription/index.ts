import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LS_HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

    const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    if (!lsKey) return json({ error: "Payment not configured" }, 500);

    const { action } = await req.json().catch(() => ({ action: "status" }));

    // Find the caller's Lemon Squeezy subscriptions by their account email.
    const listRes = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions?filter[user_email]=${encodeURIComponent(user.email)}&page[size]=20`,
      { headers: LS_HEADERS(lsKey) }
    );
    const listData = await listRes.json();
    const subs = Array.isArray(listData.data) ? listData.data : [];

    const active = subs.find((s: any) =>
      ["active", "on_trial", "past_due", "paused"].includes(s.attributes?.status)
    );

    if (action === "cancel") {
      if (!active) {
        return json({
          error:
            "No active recurring subscription was found for your email. If you paid a one-off (e.g. via card in Naira) there is nothing to cancel — access simply ends on your expiry date.",
        }, 404);
      }
      const cancelRes = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${active.id}`, {
        method: "DELETE",
        headers: LS_HEADERS(lsKey),
      });
      const cancelData = await cancelRes.json().catch(() => ({}));
      if (!cancelRes.ok) {
        console.error("LS cancel failed", JSON.stringify(cancelData));
        return json({ error: "Could not cancel subscription. Please contact support." }, 502);
      }
      const attrs = cancelData.data?.attributes ?? {};
      return json({
        cancelled: true,
        status: attrs.status ?? "cancelled",
        endsAt: attrs.ends_at ?? active.attributes?.renews_at ?? null,
      });
    }

    // status
    if (!active) return json({ hasSubscription: false });
    const a = active.attributes ?? {};
    return json({
      hasSubscription: true,
      status: a.status,
      cancelled: !!a.cancelled,
      productName: a.product_name,
      variantName: a.variant_name,
      renewsAt: a.renews_at ?? null,
      endsAt: a.ends_at ?? null,
      portalUrl: a.urls?.customer_portal ?? null,
      updatePaymentUrl: a.urls?.update_payment_method ?? null,
    });
  } catch (err) {
    console.error("manage-subscription error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});
