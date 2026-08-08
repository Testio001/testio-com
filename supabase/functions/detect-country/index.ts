import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const normalizeCountry = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase().slice(0, 2) : "";

const fetchCountry = async (url: string, read: (data: any) => unknown) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "testio/2.0" },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return normalizeCountry(read(await response.json()));
  } finally {
    clearTimeout(timeout);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const headerCountry = normalizeCountry(
      req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country"),
    );
    if (headerCountry) {
      return new Response(JSON.stringify({ country: headerCountry }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" },
      });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "";

    let country = "";
    if (ip) {
      const encodedIp = encodeURIComponent(ip);
      const providers = [
        () => fetchCountry(`https://ipapi.co/${encodedIp}/json/`, (data) => data?.country_code || data?.country),
        () => fetchCountry(`https://ipwho.is/${encodedIp}`, (data) => data?.country_code),
      ];
      for (const provider of providers) {
        try {
          country = await provider();
          if (country) break;
        } catch (error) {
          console.error("Country provider failed", error);
        }
      }
    }

    return new Response(JSON.stringify({ country }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("Country detection failed", error);
    return new Response(JSON.stringify({ country: "" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});