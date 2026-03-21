import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Fetch the YouTube page to get caption tracks
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const pageResponse = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!pageResponse.ok) throw new Error("Failed to fetch YouTube page");

  const pageHtml = await pageResponse.text();

  // Extract captions player response
  const captionMatch = pageHtml.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s);
  if (!captionMatch) {
    // Try alternative: get title from page for context
    const titleMatch = pageHtml.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "";
    
    // Try to get description
    const descMatch = pageHtml.match(/"shortDescription":"(.*?)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, "\n").substring(0, 5000) : "";
    
    if (title || description) {
      return `YouTube Video: ${title}\n\nDescription:\n${description}\n\nNote: Auto-generated captions were not available for this video. Content is based on available metadata.`;
    }
    throw new Error("No captions available for this video");
  }

  // Parse captions JSON
  let captionsData;
  try {
    const captionsJson = captionMatch[1];
    captionsData = JSON.parse(captionsJson);
  } catch {
    throw new Error("Failed to parse caption data");
  }

  const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) throw new Error("No caption tracks found");

  // Prefer English, fall back to first available
  const englishTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"));
  const track = englishTrack || tracks[0];
  const captionUrl = track.baseUrl;

  if (!captionUrl) throw new Error("No caption URL found");

  // Fetch the caption XML
  const captionResponse = await fetch(captionUrl);
  if (!captionResponse.ok) throw new Error("Failed to fetch captions");

  const captionXml = await captionResponse.text();

  // Parse XML to extract text
  const textParts: string[] = [];
  const textRegex = /<text[^>]*>(.*?)<\/text>/gs;
  let match;
  while ((match = textRegex.exec(captionXml)) !== null) {
    let text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim();
    if (text) textParts.push(text);
  }

  if (textParts.length === 0) throw new Error("No text found in captions");

  // Also try to get the video title
  const titleMatch = pageHtml.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "YouTube Video";

  return `YouTube Video: ${title}\n\nTranscript:\n${textParts.join(" ")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (!doc) throw new Error("Document not found");

    await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    let extractedContent = doc.original_content || "";

    // Check if the content is a YouTube URL
    if (extractedContent && (extractedContent.includes("youtube.com") || extractedContent.includes("youtu.be"))) {
      console.log("Detected YouTube URL, extracting transcript...");
      const videoId = extractYouTubeVideoId(extractedContent.trim());
      if (videoId) {
        try {
          extractedContent = await fetchYouTubeTranscript(videoId);
          console.log(`Extracted YouTube transcript: ${extractedContent.length} chars`);
        } catch (ytError) {
          console.error("YouTube transcript error:", ytError);
          extractedContent = `YouTube Video URL: ${extractedContent}. Could not extract transcript: ${ytError instanceof Error ? ytError.message : "Unknown error"}. Please try pasting the video content manually.`;
        }
      }
    }

    // If document has a storage_path (uploaded file), download and extract text
    if (doc.storage_path && !extractedContent) {
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
