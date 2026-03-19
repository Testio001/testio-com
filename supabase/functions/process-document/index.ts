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

    // If document has a storage_path (uploaded file), download and extract text
    if (doc.storage_path && !doc.original_content) {
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
          // Extract text from PDF using pdf-parse
          try {
            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Use a simple PDF text extraction approach
            // Convert to string and extract readable text between stream markers
            const rawText = new TextDecoder('latin1').decode(uint8Array);
            
            // Extract text content from PDF
            const textParts: string[] = [];
            
            // Method 1: Extract text between BT and ET markers (text objects)
            const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
            let match;
            while ((match = btEtRegex.exec(rawText)) !== null) {
              const textBlock = match[1];
              // Extract strings in parentheses (literal strings)
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
              // Extract hex strings
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
            
            // If extraction yielded very little, try a broader approach
            if (extractedContent.length < 100) {
              // Fallback: extract any readable ASCII sequences
              const readableRegex = /[\x20-\x7E]{10,}/g;
              const readableParts: string[] = [];
              let rMatch;
              while ((rMatch = readableRegex.exec(rawText)) !== null) {
                const text = rMatch[0].trim();
                // Filter out PDF commands and binary-looking strings
                if (text && !text.match(/^[\/\[\]<>{}%]+$/) && !text.match(/^\d+\s+\d+\s+obj/)) {
                  readableParts.push(text);
                }
              }
              if (readableParts.join(' ').length > extractedContent.length) {
                extractedContent = readableParts.join(' ');
              }
            }

            // If still no meaningful content, use AI to describe what we know
            if (extractedContent.length < 50) {
              extractedContent = `PDF Document: ${doc.title}. The PDF content could not be fully extracted via text parsing. File size: ${uint8Array.length} bytes. Please generate study materials based on the document title and any available context.`;
            }

            console.log(`Extracted ${extractedContent.length} chars from PDF`);
          } catch (pdfError) {
            console.error("PDF extraction error:", pdfError);
            extractedContent = `PDF Document: ${doc.title}. Unable to extract text directly. Please generate study materials based on the document title.`;
          }
        } else {
          // For text files, just read as text
          extractedContent = await fileData.text();
        }
      }
    }

    if (!extractedContent) {
      extractedContent = `Document: ${doc.title}. Source type: ${doc.source_type}.`;
    }

    // Save extracted content to document
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
