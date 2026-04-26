import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_VARIANTS: Record<string, { variant_id: number; product_id: number }> = {
  basic: { variant_id: 1504464, product_id: 957604 },
  pro: { variant_id: 1504491, product_id: 957624 },
  scholar: { variant_id: 1537626, product_id: 979773 },
  podcast_addon: { variant_id: 1519137, product_id: 967498 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { plan } = await req.json();
    if (!plan || !PLAN_VARIANTS[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan. Must be 'basic', 'pro', 'scholar', or 'podcast_addon'." }), { status: 400, headers: corsHeaders });
    }

    const lsKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    if (!lsKey) {
      return new Response(JSON.stringify({ error: "Payment not configured" }), { status: 500, headers: corsHeaders });
    }

    const variant = PLAN_VARIANTS[plan];

    const storeRes = await fetch("https://api.lemonsqueezy.com/v1/stores", {
      headers: {
        Authorization: `Bearer ${lsKey}`,
        Accept: "application/vnd.api+json",
      },
    });
    const storeData = await storeRes.json();
    const storeId = storeData.data?.[0]?.id;
    if (!storeId) {
      console.error("No store found:", JSON.stringify(storeData));
      return new Response(JSON.stringify({ error: "No store found" }), { status: 500, headers: corsHeaders });
    }

    const redirectUrl = plan === "podcast_addon"
      ? "https://testio-com.lovable.app/dashboard?purchase=podcast_success"
      : "https://testio-com.lovable.app/pricing?payment=success";

    const checkoutRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lsKey}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: user.email,
              custom: {
                user_id: user.id,
                plan: plan,
              },
            },
            product_options: {
              redirect_url: redirectUrl,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: storeId,
              },
            },
            variant: {
              data: {
                type: "variants",
                id: String(variant.variant_id),
              },
            },
          },
        },
      }),
    });

    const checkoutData = await checkoutRes.json();

    if (!checkoutRes.ok) {
      console.error("Lemon Squeezy error:", JSON.stringify(checkoutData));
      return new Response(JSON.stringify({ error: checkoutData.errors?.[0]?.detail || "Checkout creation failed" }), { status: 400, headers: corsHeaders });
    }

    const checkoutUrl = checkoutData.data?.attributes?.url;

    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
