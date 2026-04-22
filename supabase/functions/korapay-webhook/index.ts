import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-korapay-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-korapay-signature") || "";
    const webhookSecret = Deno.env.get("KORAPAY_WEBHOOK_SECRET");

    if (webhookSecret) {
      // Korapay signs the `data` payload with HMAC SHA256 using the secret key
      const parsed = JSON.parse(rawBody);
      const dataStr = JSON.stringify(parsed.data);
      const expected = createHmac("sha256", webhookSecret).update(dataStr).digest("hex");
      if (expected !== signature) {
        console.error("Invalid Korapay signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const data = event.data || {};
    const reference = data.reference;

    if (!reference) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tx } = await admin
      .from("korapay_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!tx) {
      console.error("Webhook: tx not found for reference", reference);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (eventType === "charge.success" || data.status === "success") {
      if (tx.status !== "success") {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await admin.from("korapay_transactions").update({ status: "success", expires_at: expiresAt }).eq("reference", reference);
        await admin.from("profiles").update({
          subscription_plan: tx.plan,
          subscription_expires_at: expiresAt,
        }).eq("user_id", tx.user_id);
      }
    } else if (eventType === "charge.failed" || data.status === "failed") {
      await admin.from("korapay_transactions").update({ status: "failed" }).eq("reference", reference);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("korapay-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});