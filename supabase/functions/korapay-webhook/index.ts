import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redeemPendingReferralOnUpgrade } from "../_shared/redeem-referral.ts";
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
    const event = JSON.parse(rawBody);

    // Korapay signature verification is unreliable across payload variants.
    // Try multiple signing schemes; if none match we DO NOT reject — instead
    // we re-verify the charge against the Korapay API below as ground truth.
    let signatureValid = false;
    if (webhookSecret && signature) {
      const candidates = [
        rawBody,
        JSON.stringify(event.data ?? {}),
        event?.data?.reference ?? "",
      ];
      for (const c of candidates) {
        try {
          const h = createHmac("sha256", webhookSecret).update(c).digest("hex");
          if (h === signature) { signatureValid = true; break; }
        } catch (_) { /* ignore */ }
      }
      if (!signatureValid) console.warn("Korapay signature mismatch — falling back to API verify");
    }

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

    // Determine real success. If signature didn't validate, re-query Korapay's API
    // before granting any reward — this prevents spoofed webhooks AND prevents lost
    // payments when Korapay changes their signing format.
    let isSuccess = (eventType === "charge.success" || data.status === "success");
    if (isSuccess && !signatureValid) {
      try {
        const koraSecret = Deno.env.get("KORAPAY_SECRET_KEY")!;
        const verifyRes = await fetch(
          `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${koraSecret}` } }
        );
        const verifyData = await verifyRes.json();
        isSuccess = verifyRes.ok && verifyData?.data?.status === "success";
        if (!isSuccess) console.error("API re-verify did not confirm success", verifyData);
      } catch (e) {
        console.error("API re-verify threw", e);
        isSuccess = false;
      }
    }

    if (isSuccess) {
      if (tx.status !== "success") {
        // Helper: send congratulations email (best-effort, idempotent by reference)
        const sendCongratsEmail = async (opts: { isAddon: boolean; expiresAt?: string }) => {
          try {
            const { data: profile } = await admin
              .from("profiles")
              .select("email, display_name")
              .eq("user_id", tx.user_id)
              .maybeSingle();
            if (!profile?.email) return;
            await admin.functions.invoke("send-transactional-email", {
              body: {
                templateName: "payment-success",
                recipientEmail: profile.email,
                idempotencyKey: `payment-success-${reference}`,
                templateData: {
                  displayName: profile.display_name ?? null,
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
          const { data: stats } = await admin.from("user_stats").select("bonus_podcasts").eq("user_id", tx.user_id).maybeSingle();
          const current = stats?.bonus_podcasts ?? 0;
          await admin.from("user_stats").update({ bonus_podcasts: current + 5 }).eq("user_id", tx.user_id);
          await sendCongratsEmail({ isAddon: true });
          console.log("Webhook: granted 5 podcast credits to", tx.user_id);
          await admin.from("in_app_notifications").insert({
            user_id: tx.user_id,
            type: "podcast_topup",
            title: "🎙️ +5 podcast credits added",
            body: "Your podcast top-up is active. Enjoy 5 more podcast generations!",
            link: "/dashboard",
          });
        } else {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await admin.from("korapay_transactions").update({ status: "success", expires_at: expiresAt }).eq("reference", reference);
          await admin.from("profiles").update({
            subscription_plan: tx.plan,
            subscription_expires_at: expiresAt,
          }).eq("user_id", tx.user_id);
          // Reset monthly usage counter so the user starts the new plan with a fresh quota.
          await admin.from("user_stats").update({ uploads_used: 0 }).eq("user_id", tx.user_id);
          await sendCongratsEmail({ isAddon: false, expiresAt });
          console.log(`Webhook: activated ${tx.plan} for`, tx.user_id);
          await redeemPendingReferralOnUpgrade(admin, tx.user_id, tx.plan);
          await admin.from("in_app_notifications").insert({
            user_id: tx.user_id,
            type: "plan_activated",
            title: `✅ ${tx.plan.charAt(0).toUpperCase() + tx.plan.slice(1)} plan activated`,
            body: "Your upload quota has been refreshed. Enjoy your new plan for 30 days!",
            link: "/dashboard",
          });
        }
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