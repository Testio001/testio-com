const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Try Cloudflare/Supabase forwarded IP headers first
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "";

    let country = "";
    try {
      const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
      const res = await fetch(url, { headers: { "User-Agent": "testio/1.0" } });
      if (res.ok) {
        const data = await res.json();
        country = data?.country_code || data?.country || "";
      }
    } catch (e) {
      console.error("ipapi failed:", e);
    }

    return new Response(JSON.stringify({ country: country.toUpperCase() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ country: "", error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});