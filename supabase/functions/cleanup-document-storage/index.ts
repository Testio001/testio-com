import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-off / on-demand cleanup: removes raw uploaded files from the `documents`
// storage bucket for every document whose text has already been extracted
// (status in completed/failed). The extracted content lives in the DB, so the
// raw source file is no longer needed.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const provided = req.headers.get("x-admin-secret");
  if (provided !== adminSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, adminSecret);

  let totalRemoved = 0;
  let totalFailed = 0;
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("documents")
      .select("id, storage_path")
      .in("status", ["completed", "failed"])
      .not("storage_path", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message, totalRemoved, totalFailed }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rows || rows.length === 0) break;

    const paths = rows.map((r: any) => r.storage_path).filter(Boolean);
    const ids = rows.map((r: any) => r.id);

    // Remove in chunks of 100 to stay within storage API limits.
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error: rmErr } = await supabase.storage.from("documents").remove(chunk);
      if (rmErr) {
        console.warn("remove chunk failed:", rmErr.message);
        totalFailed += chunk.length;
      } else {
        totalRemoved += chunk.length;
      }
    }

    // Null out storage_path for the rows we processed.
    await supabase.from("documents").update({ storage_path: null }).in("id", ids);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return new Response(JSON.stringify({ success: true, totalRemoved, totalFailed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});