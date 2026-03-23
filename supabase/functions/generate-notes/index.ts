import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractPdfContent(fileData: Blob): Promise<string> {
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

  let content = textParts.join(' ').replace(/\s+/g, ' ').trim();

  if (content.length < 100) {
    const readableRegex = /[\x20-\x7E]{10,}/g;
    const readableParts: string[] = [];
    let rMatch;
    while ((rMatch = readableRegex.exec(rawText)) !== null) {
      const text = rMatch[0].trim();
      if (text && !text.match(/^[\/\[\]<>{}%]+$/) && !text.match(/^\d+\s+\d+\s+obj/)) {
        readableParts.push(text);
      }
    }
    if (readableParts.join(' ').length > content.length) {
      content = readableParts.join(' ');
    }
  }

  return content;
}

async function extractWithOpenAI(fileData: Blob, title: string, openaiKey: string): Promise<string> {
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);

  const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract ALL text content from this PDF document. Include every word, heading, paragraph, bullet point, and piece of text. Preserve the structure. Do NOT summarize - extract the raw text." },
          { type: "file", file: { filename: `${title}.pdf`, file_data: `data:application/pdf;base64,${pdfBase64}` } }
        ]
      }],
      max_tokens: 16000,
    }),
  });

  if (!ocrRes.ok) return "";

  const ocrData = await ocrRes.json();
  return ocrData.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc, error: docError } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (docError || !doc) throw new Error("Document not found");

    await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    let content = doc.original_content;

    // If original_content is missing/empty, try to extract it directly
    if (!content || content.length < 20) {
      console.log("original_content is empty, attempting direct extraction...");

      if (doc.storage_path) {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("documents")
          .download(doc.storage_path);

        if (dlError || !fileData) {
          console.error("Failed to download file:", dlError?.message);
        } else {
          const fileType = doc.storage_path.split('.').pop()?.toLowerCase();

          if (fileType === 'pdf') {
            // Try regex extraction first
            content = await extractPdfContent(fileData);
            console.log(`Regex PDF extraction: ${content?.length || 0} chars`);

            // If regex fails, use OpenAI
            if (!content || content.length < 100) {
              console.log("Regex insufficient, using OpenAI for PDF extraction...");
              content = await extractWithOpenAI(fileData, doc.title, OPENAI_API_KEY);
              console.log(`OpenAI PDF extraction: ${content?.length || 0} chars`);
            }
          } else {
            content = await fileData.text();
          }

          // Save the extracted content back to the document
          if (content && content.length >= 20) {
            const { error: updateError } = await supabase.from("documents").update({
              original_content: content.substring(0, 50000)
            }).eq("id", documentId);
            if (updateError) {
              console.error("Failed to save extracted content:", updateError.message);
            }
          }
        }
      }
    }

    if (!content || content.length < 20) {
      await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
      return new Response(JSON.stringify({ error: "Document content could not be extracted. Please try re-uploading or use text input instead." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert study notes creator. Generate beautiful, comprehensive study notes in markdown format from the provided content. Follow this exact style:

1. Start with a main title using # with a relevant emoji (e.g., "# 📚 Software Engineering Overview")
2. Add a "## Brief Overview" section with a short paragraph summarizing the document
3. Add a "## Key Points" section with bullet points
4. Then create detailed sections for each major topic using ## headings with relevant emojis
5. Use **bold text** for important terms and key concepts
6. Use > blockquotes for definitions and important statements
7. Use --- horizontal rules between major sections
8. Use ### for sub-sections within major topics
9. Include bullet points and numbered lists where appropriate
10. Make the notes thorough, covering ALL content from the source material
11. Use emojis in section headings to make them visually distinct

The notes should be detailed, well-structured, and visually appealing when rendered as markdown. Cover every topic mentioned in the source content thoroughly.`
          },
          {
            role: "user",
            content: `Generate detailed study notes from the following content:\n\n${content.substring(0, 15000)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const notesContent = aiData.choices?.[0]?.message?.content || "No notes generated.";

    await supabase.from("notes").insert({
      user_id: doc.user_id,
      document_id: documentId,
      title: `Notes: ${doc.title}`,
      content: notesContent,
    });

    await supabase.from("documents").update({ status: "completed" }).eq("id", documentId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
