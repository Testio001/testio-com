import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const allowedSourceTypes = new Set(["pdf", "docx", "text", "image"]);

function safeExtension(value?: string) {
  const ext = (value || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return ext || "bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sourceType = String(body.sourceType || body.source_type || "");
    if (!allowedSourceTypes.has(sourceType)) {
      return new Response(JSON.stringify({ error: "Unsupported document type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = String(body.title || "Untitled").trim().slice(0, 180) || "Untitled";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const insertData: Record<string, unknown> = {
      user_id: userId,
      title,
      source_type: sourceType,
      status: "pending",
    };

    let upload: { path: string; token: string } | null = null;
    if (sourceType === "text") {
      const originalContent = String(body.originalContent || body.original_content || "").trim();
      if (!originalContent) {
        return new Response(JSON.stringify({ error: "Text content is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      insertData.original_content = originalContent;
    } else {
      const storagePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${safeExtension(body.fileExt || body.file_ext)}`;
      insertData.storage_path = storagePath;
      const { data: signedUpload, error: signedError } = await supabase.storage
        .from("documents")
        .createSignedUploadUrl(storagePath);
      if (signedError || !signedUpload) throw signedError || new Error("Could not create upload URL");
      upload = { path: signedUpload.path, token: signedUpload.token };
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ document, upload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create document";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});