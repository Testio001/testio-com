import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redeemPendingReferralOnUpgrade } from "../_shared/redeem-referral.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") {
      return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: corsHeaders });
    }

    // Look up transaction
    const { data: tx, error: txErr } = await admin
      .from("korapay_transactions")
      .select("*")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .maybeSingle();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404, headers: corsHeaders });
    }

    // If already success, return current state
    if (tx.status === "success") {
      return new Response(JSON.stringify({ success: true, plan: tx.plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const koraSecret = Deno.env.get("KORAPAY_SECRET_KEY")!;
    const verifyRes = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${koraSecret}` } }
    );
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData?.status) {
      return new Response(JSON.stringify({ success: false, error: verifyData?.message || "Verification failed" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const status = verifyData.data?.status;
    if (status === "success") {
      // Helper to fire the congratulations email (best-effort)
      const sendCongratsEmail = async (opts: { isAddon: boolean; expiresAt?: string }) => {
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("email, display_name")
            .eq("user_id", user.id)
            .maybeSingle();
          const recipient = profile?.email || user.email;
          if (!recipient) return;
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "payment-success",
              recipientEmail: recipient,
              idempotencyKey: `payment-success-${reference}`,
              templateData: {
                displayName: profile?.display_name ?? null,
                planLabel: tx.plan,
                isAddon: opts.isAddon,
                expiresAt: opts.expiresAt ?? null,
              },
            },
          });
        } catch (e) {
          console.error("payment-success email failed", e);
        }
      };

      if (tx.plan === "podcast_addon") {
        await admin.from("korapay_transactions").update({ status: "success" }).eq("reference", reference);
        const { data: stats } = await admin.from("user_stats").select("bonus_podcasts").eq("user_id", user.id).maybeSingle();
        const current = stats?.bonus_podcasts ?? 0;
        await admin.from("user_stats").update({ bonus_podcasts: current + 5 }).eq("user_id", user.id);
        await sendCongratsEmail({ isAddon: true });
        return new Response(JSON.stringify({ success: true, plan: tx.plan, addon: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("korapay_transactions").update({ status: "success", expires_at: expiresAt }).eq("reference", reference);
      await admin.from("profiles").update({
        subscription_plan: tx.plan,
        subscription_expires_at: expiresAt,
      }).eq("user_id", user.id);
      // Reset monthly usage counter so the user starts the new plan with a fresh quota.
      await admin.from("user_stats").update({ uploads_used: 0 }).eq("user_id", user.id);
      await sendCongratsEmail({ isAddon: false, expiresAt });
      await redeemPendingReferralOnUpgrade(admin, user.id, tx.plan);

      return new Response(JSON.stringify({ success: true, plan: tx.plan, expires_at: expiresAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("korapay-verify error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});