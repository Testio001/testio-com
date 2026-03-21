import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (!doc) throw new Error("Document not found");

    await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    let extractedContent = doc.original_content || "";

    // If document is an image, use OpenAI Vision to extract text
    if (doc.source_type === "image" && doc.storage_path) {
      console.log("Processing image with OpenAI Vision...");
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(doc.storage_path);

      if (downloadError) throw new Error(`Failed to download image: ${downloadError.message}`);

      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const ext = doc.storage_path.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OpenAI API key not configured");

      const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extract ALL text content from this image. Include every word, number, heading, label, and piece of text you can see. Preserve the structure and formatting as much as possible. If it's a document, textbook page, or notes, capture everything in full detail." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }],
          max_tokens: 4096,
        }),
      });

      if (!visionRes.ok) {
        const errBody = await visionRes.text();
        console.error("Vision API error:", errBody);
        throw new Error("Failed to extract text from image");
      }

      const visionData = await visionRes.json();
      extractedContent = visionData.choices?.[0]?.message?.content || "";
      console.log(`Extracted ${extractedContent.length} chars from image via Vision`);
    }

    // If document has a storage_path (uploaded file), download and extract text
    if (doc.storage_path && !extractedContent && doc.source_type !== "image") {
      console.log("Downloading file from storage:", doc.storage_path);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(doc.storage_path);

      if (downloadError) {
        console.error("Download error:", downloadError);
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      if (fileData) {
        const fileType = doc.storage_path.split('.').pop()?.toLowerCase();
        
        if (fileType === 'pdf') {
          try {
            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const rawText = new TextDecoder('latin1').decode(uint8Array);
            const textParts: string[] = [];
            
            const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
            let match;
            while ((match = btEtRegex.exec(rawText)) !== null) {
              const textBlock = match[1];
              const parenRegex = /\(([^)]*)\)/g;
              let strMatch;
              while ((strMatch = parenRegex.exec(textBlock)) !== null) {
                const decoded = strMatch[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t')
                  .replace(/\\\\/g, '\\')
                  .replace(/\\([()])/g, '$1');
                if (decoded.trim()) textParts.push(decoded);
              }
              const hexRegex = /<([0-9A-Fa-f]+)>/g;
              let hexMatch;
              while ((hexMatch = hexRegex.exec(textBlock)) !== null) {
                const hex = hexMatch[1];
                let hexText = '';
                for (let i = 0; i < hex.length; i += 2) {
                  const charCode = parseInt(hex.substr(i, 2), 16);
                  if (charCode >= 32 && charCode < 127) {
                    hexText += String.fromCharCode(charCode);
                  }
                }
                if (hexText.trim()) textParts.push(hexText);
              }
            }
            
            extractedContent = textParts.join(' ').replace(/\s+/g, ' ').trim();
            
            if (extractedContent.length < 100) {
              const readableRegex = /[\x20-\x7E]{10,}/g;
              const readableParts: string[] = [];
              let rMatch;
              while ((rMatch = readableRegex.exec(rawText)) !== null) {
                const text = rMatch[0].trim();
                if (text && !text.match(/^[\/\[\]<>{}%]+$/) && !text.match(/^\d+\s+\d+\s+obj/)) {
                  readableParts.push(text);
                }
              }
              if (readableParts.join(' ').length > extractedContent.length) {
                extractedContent = readableParts.join(' ');
              }
            }

            if (extractedContent.length < 50) {
              extractedContent = `PDF Document: ${doc.title}. The PDF content could not be fully extracted via text parsing. File size: ${uint8Array.length} bytes. Please generate study materials based on the document title and any available context.`;
            }

            console.log(`Extracted ${extractedContent.length} chars from PDF`);
          } catch (pdfError) {
            console.error("PDF extraction error:", pdfError);
            extractedContent = `PDF Document: ${doc.title}. Unable to extract text directly. Please generate study materials based on the document title.`;
          }
        } else {
          extractedContent = await fileData.text();
        }
      }
    }

    if (!extractedContent) {
      extractedContent = `Document: ${doc.title}. Source type: ${doc.source_type}.`;
    }

    await supabase.from("documents").update({ 
      status: "completed", 
      original_content: extractedContent.substring(0, 50000) 
    }).eq("id", documentId);

    return new Response(JSON.stringify({ success: true, contentLength: extractedContent.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});