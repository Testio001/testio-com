import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan -> NGN amount (kobo = NGN * 100)
const PLAN_NGN: Record<string, number> = {
  starter: 4490,
  basic: 7800,
  pro: 14990,
  scholar: 29990,
  podcast_addon: 7800,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { plan } = await req.json();
    if (!plan || !PLAN_NGN[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan. Must be 'starter', 'basic', 'pro', 'scholar', or 'podcast_addon'." }), { status: 400, headers: corsHeaders });
    }

    const koraSecret = Deno.env.get("KORAPAY_SECRET_KEY");
    if (!koraSecret) {
      return new Response(JSON.stringify({ error: "Korapay not configured" }), { status: 500, headers: corsHeaders });
    }

    const amountNgn = PLAN_NGN[plan];
    const reference = `kp_${user.id.slice(0, 8)}_${Date.now()}`;
    const redirectUrl = plan === "podcast_addon"
      ? `https://testio-com.lovable.app/dashboard?korapay=success&reference=${reference}`
      : `https://testio-com.lovable.app/pricing?korapay=success&reference=${reference}`;

    // Insert pending transaction
    const { error: insertErr } = await admin.from("korapay_transactions").insert({
      user_id: user.id,
      reference,
      plan,
      amount_ngn: amountNgn,
      status: "pending",
    });
    if (insertErr) {
      console.error("Insert tx error:", insertErr);
      return new Response(JSON.stringify({ error: "Could not create transaction" }), { status: 500, headers: corsHeaders });
    }

    // Initialize Korapay charge
    const koraRes = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${koraSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountNgn,
        currency: "NGN",
        reference,
        narration: plan === "podcast_addon"
          ? "Testio podcast top-up (5 credits)"
          : `Testio ${plan} plan (30 days)`,
        notification_url: `${supabaseUrl}/functions/v1/korapay-webhook`,
        redirect_url: redirectUrl,
        customer: {
          email: user.email,
          name: user.email?.split("@")[0] || "Testio user",
        },
        metadata: {
          user_id: user.id,
          plan,
        },
      }),
    });

    const koraData = await koraRes.json();
    if (!koraRes.ok || !koraData?.status) {
      console.error("Korapay error:", JSON.stringify(koraData));
      return new Response(JSON.stringify({ error: koraData?.message || "Checkout creation failed" }), { status: 400, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ checkout_url: koraData.data?.checkout_url, reference }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("korapay-initialize error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});