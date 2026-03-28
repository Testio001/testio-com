import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractDocumentContent, sanitizeForDb } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { documentId } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (!doc) throw new Error("Document not found");

    // Verify ownership
    if (doc.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    // Use shared extraction with quality gates
    const result = await extractDocumentContent({ supabase, doc, openaiKey });

    if (!result.success) {
      console.error("Extraction failed:", result.error);
      await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
      return new Response(
        JSON.stringify({ error: result.error || "Could not extract text from this file. Please try re-uploading a clearer version." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extraction succeeded via ${result.method}: ${result.content.length} chars`);

    // Save sanitized content
    const contentToSave = result.content.substring(0, 50000);
    const updateData: any = {
      status: "completed",
      original_content: contentToSave,
    };
    // Fix source_type if we detected a misclassified DOCX
    if (result.method.startsWith("docx") && doc.source_type !== "docx") {
      updateData.source_type = "docx";
    }

    const { error: updateError } = await supabase.from("documents").update(updateData).eq("id", documentId);

    if (updateError) {
      console.error("Failed to save content:", updateError.message);
      await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Document was processed but couldn't be saved. Please try re-uploading." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Document content saved successfully");

    return new Response(JSON.stringify({ success: true, contentLength: result.content.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
