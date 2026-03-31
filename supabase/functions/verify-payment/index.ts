import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: corsHeaders });
    }

    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) {
      return new Response(JSON.stringify({ error: "Payment not configured" }), { status: 500, headers: corsHeaders });
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(
        JSON.stringify({ success: false, message: "Payment not successful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract plan from metadata
    const plan = verifyData.data.metadata?.plan;
    if (!plan || !["basic", "pro"].includes(plan)) {
      return new Response(JSON.stringify({ error: "Invalid plan in payment" }), { status: 400, headers: corsHeaders });
    }

    // Verify the user_id in metadata matches the authenticated user
    const metaUserId = verifyData.data.metadata?.user_id;
    if (metaUserId !== userId) {
      return new Response(JSON.stringify({ error: "User mismatch" }), { status: 403, headers: corsHeaders });
    }

    // Update profile with subscription
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        subscription_plan: plan,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to activate subscription" }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ success: true, plan, expires_at: expiresAt.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
