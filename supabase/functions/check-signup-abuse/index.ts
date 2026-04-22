import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Disposable email domains (server-side mirror)
const DISPOSABLE = new Set<string>([
  "mailinator.com","tempmail.com","temp-mail.org","temp-mail.io",
  "10minutemail.com","10minutemail.net","guerrillamail.com","guerrillamail.net",
  "guerrillamail.org","guerrillamail.biz","sharklasers.com","yopmail.com",
  "throwawaymail.com","trashmail.com","trashmail.de","getnada.com",
  "fakeinbox.com","maildrop.cc","dispostable.com","mintemail.com","mohmal.com",
  "moakt.com","emailondeck.com","tempinbox.com","spam4.me","tempr.email",
  "discard.email","mailnesia.com","inboxbear.com","burnermail.io","mvrht.net",
  "anonbox.net","fakemail.net","mytemp.email","mailcatch.com","trbvm.com",
  "spambog.com","spamgourmet.com","tempemail.net","tempemail.co",
  "20minutemail.com","1secmail.com","1secmail.net","1secmail.org",
  "anonymousmail.org","throwam.com",
]);

function isDisposable(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return DISPOSABLE.has(email.slice(at + 1).toLowerCase().trim());
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fingerprint } = await req.json();
    if (!fingerprint || typeof fingerprint !== "string") {
      return new Response(JSON.stringify({ error: "fingerprint required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "";
    const ipHash = ip ? await sha256(ip) : null;

    // Check abuse via RPC
    const { data: abuseData, error: abuseErr } = await supabaseAdmin.rpc(
      "check_device_abuse",
      { _fingerprint: fingerprint, _email: email },
    );
    if (abuseErr) throw abuseErr;

    const result = abuseData as {
      device_account_count: number;
      device_history_count: number;
      email_previously_deleted: boolean;
      is_abuse: boolean;
    };

    const disposable = isDisposable(email);
    const isAbuse = result.is_abuse || disposable;

    let abuseReason: string | null = null;
    if (disposable) abuseReason = "disposable_email";
    else if (result.device_account_count > 0) abuseReason = "duplicate_device";
    else if (result.device_history_count > 0) abuseReason = "deleted_account_device";
    else if (result.email_previously_deleted) abuseReason = "deleted_account_email";

    // Register this device for the user (upsert-like: ignore dupes)
    const { data: existingFp } = await supabaseAdmin
      .from("device_fingerprints")
      .select("id")
      .eq("user_id", user.id)
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (!existingFp) {
      await supabaseAdmin.from("device_fingerprints").insert({
        user_id: user.id,
        fingerprint,
        ip_hash: ipHash,
      });
    }

    // If abuse, flag the user_stats row (create if missing)
    if (isAbuse) {
      const { data: stats } = await supabaseAdmin
        .from("user_stats")
        .select("id, is_abuse_flagged")
        .eq("user_id", user.id)
        .maybeSingle();

      if (stats) {
        if (!stats.is_abuse_flagged) {
          await supabaseAdmin
            .from("user_stats")
            .update({
              is_abuse_flagged: true,
              abuse_reason: abuseReason,
            })
            .eq("user_id", user.id);
        }
      } else {
        // Create stats row pre-flagged so get-stats picks it up
        const code = "testio-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        await supabaseAdmin.from("user_stats").insert({
          user_id: user.id,
          referral_code: code,
          is_abuse_flagged: true,
          abuse_reason: abuseReason,
        });
      }
    }

    return new Response(
      JSON.stringify({
        is_abuse: isAbuse,
        reason: abuseReason,
        details: { ...result, disposable_email: disposable },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("check-signup-abuse error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});