// Shared helper: when a user successfully upgrades to a paid plan, redeem any
// pending referral so the referrer earns their bonus upload + streak freeze.
// Idempotent — once status='rewarded', we never reward again.

export async function redeemPendingReferralOnUpgrade(
  admin: any,
  referredUserId: string,
  newPlan: string
) {
  try {
    const paidPlans = ["starter", "basic", "pro", "scholar", "elite"];
    if (!paidPlans.includes(newPlan)) return;

    const { data: ref } = await admin
      .from("referrals")
      .select("id, referrer_user_id, status")
      .eq("referred_user_id", referredUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (!ref) return;

    // Mark as rewarded first to prevent double-reward races
    const { data: claimed } = await admin
      .from("referrals")
      .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
      .eq("id", ref.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    // Referral bonus uploads have been removed. We still mark the referral as
    // rewarded above (for tracking) and send a thank-you notification, but no
    // bonus_uploads or streak_freezes are granted.
    await admin.from("in_app_notifications").insert({
      user_id: ref.referrer_user_id,
      type: "referral_reward",
      title: "🎉 Your referral just upgraded!",
      body: "Thanks for spreading the word — your friend just upgraded to a paid plan.",
      link: "/dashboard",
    });

    // Best-effort email
    try {
      const { data: rProfile } = await admin
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", ref.referrer_user_id)
        .maybeSingle();
      if (rProfile?.email) {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "referral-success",
            recipientEmail: rProfile.email,
            idempotencyKey: `referral-success-${ref.id}`,
            templateData: {
              displayName: rProfile.display_name || rProfile.email.split("@")[0],
            },
          },
        });
      }
    } catch (e) {
      console.error("redeemPendingReferralOnUpgrade email failed", e);
    }
  } catch (e) {
    console.error("redeemPendingReferralOnUpgrade error:", e);
  }
}