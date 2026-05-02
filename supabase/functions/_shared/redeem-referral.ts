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

    const { data: rStats } = await admin
      .from("user_stats")
      .select("bonus_uploads, streak_freezes")
      .eq("user_id", ref.referrer_user_id)
      .maybeSingle();

    if (rStats) {
      await admin
        .from("user_stats")
        .update({
          bonus_uploads: (rStats.bonus_uploads || 0) + 1,
          streak_freezes: (rStats.streak_freezes || 0) + 1,
        })
        .eq("user_id", ref.referrer_user_id);
    }

    // Also reward the referred user (+1 bonus upload) — both sides win.
    const { data: refdStats } = await admin
      .from("user_stats")
      .select("bonus_uploads")
      .eq("user_id", referredUserId)
      .maybeSingle();
    if (refdStats) {
      await admin
        .from("user_stats")
        .update({ bonus_uploads: (refdStats.bonus_uploads || 0) + 1 })
        .eq("user_id", referredUserId);
    }

    // Notify referred user too
    await admin.from("in_app_notifications").insert({
      user_id: referredUserId,
      type: "referral_reward",
      title: "🎉 Referral bonus unlocked!",
      body: "Thanks for upgrading — you earned +1 bonus upload as a referral reward.",
      link: "/dashboard",
    });

    // Notify referrer
    await admin.from("in_app_notifications").insert({
      user_id: ref.referrer_user_id,
      type: "referral_reward",
      title: "🎉 Referral reward unlocked!",
      body: "Your friend just upgraded — you earned +1 bonus upload and +1 streak freeze.",
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