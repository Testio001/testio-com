import { supabase } from "@/integrations/supabase/client";

const KEY = "testio_pending_ref";
const VALID = /^[A-Za-z0-9_-]{3,40}$/;

/** Saves ?ref=CODE from any landing URL so it survives redirects and Google sign-in. */
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && VALID.test(code)) localStorage.setItem(KEY, code);
  } catch { /* storage unavailable */ }
}

let running = false;

/** After sign-in, link the saved referral once. The server rejects self, duplicate and old accounts. */
export async function redeemPendingReferral(metaCode?: string | null) {
  if (running) return;
  let code: string | null = null;
  try { code = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!code && metaCode && VALID.test(metaCode)) code = metaCode;
  if (!code) return;
  running = true;
  try {
    const { error } = await supabase.functions.invoke("manage-gamification", {
      body: { action: "process-referral", referralCode: code },
    });
    if (!error) {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
  } finally {
    running = false;
  }
}
