// Shared content extraction helper for all edge functions
// Provides quality gating, sanitization, DOCX support, and OCR fallback

const PDF_JUNK_PATTERNS = [
  /\bobj\b/g, /\bendobj\b/g, /\/Type\b/g, /\/Filter\b/g, /\/Catalog\b/g,
  /\/Page\b/g, /\/Font\b/g, /\/Length\b/g, /\/FlateDecode\b/g,
  /\/Resources\b/g, /\/MediaBox\b/g, /\/Contents\b/g, /\/Subtype\b/g,
  /\/BaseFont\b/g, /\/Encoding\b/g, /stream\b/g, /endstream\b/g,
  /xref\b/g, /trailer\b/g, /startxref\b/g, /%PDF-/g,
];

const DOCX_CORRUPTION_PATTERNS = [
  /\[Content_Types\]\.xml/i,
  /word\/document\.xml/i,
  /word\/_rels/i,
  /theme1\.xml/i,
  /_rels\/\.rels/i,
  /PK\x03\x04/,
  /<w:document/i,
  /<w:body/i,
  /<w:p\b/i,
  /<\/w:document>/i,
  /xmlns:w="http:\/\/schemas\.openxmlformats/i,
];

const AI_REFUSAL_PATTERNS = [
  /I'm unable to extract/i,
  /I cannot extract/i,
  /unable to read the content/i,
  /appears to be a .*(binary|encoded|corrupted)/i,
  /document structure overview/i,
  /xml \(extensible markup language\)/i,
  /word processing file/i,
  /encapsulation of content types/i,
  /limitations of extracting text/i,
  /PDF Document Interpretation/i,
  /direct text extraction is not always possible/i,
  /assistance cannot be provided in the form of direct content extraction/i,
  /extracting text from a PDF can be challenging/i,
  /I (?:can't|cannot|am unable to) (?:directly )?(?:extract|read|access|view|parse) (?:the )?(?:text|content|data)/i,
  /this (?:PDF|document|file) (?:appears to )?(?:contain|is) (?:mostly )?(image|scan|unreadable)/i,
  /unfortunately,? I (?:can't|cannot|don't have|am not able)/i,
  /I don't have the ability to (?:read|extract|parse|process)/i,
];

function isCorruptedContent(text: string): boolean {
  if (!text || text.length < 20) return false;
  const sample = text.substring(0, 3000);
  let docxHits = 0;
  for (const pattern of DOCX_CORRUPTION_PATTERNS) {
    if (pattern.test(sample)) docxHits++;
  }
  if (docxHits >= 2) return true;
  for (const pattern of AI_REFUSAL_PATTERNS) {
    if (pattern.test(sample)) return true;
  }
  if (sample.startsWith("PK")) return true;
  return false;
}

export function isQualityContent(text: string): boolean {
  if (!text || text.length < 50) return false;
  if (isCorruptedContent(text)) return false;
  const sample = text.substring(0, 5000);
  let junkHits = 0;
  for (const pattern of PDF_JUNK_PATTERNS) {
    const matches = sample.match(pattern);
    junkHits += matches?.length || 0;
  }
  const wordCount = sample.split(/\s+/).length;
  if (wordCount > 0 && junkHits / wordCount > 0.05) return false;
  const words = sample.split(/\s+/).filter(w => w.length >= 2);
  const readableWords = words.filter(w => /^[a-zA-Z0-9.,;:!?'"()\-\u00C0-\u024F]+$/.test(w));
  if (words.length > 0 && readableWords.length / words.length < 0.4) return false;
  const nonPrintable = (sample.match(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g) || []).length;
  if (nonPrintable / sample.length > 0.15) return false;
  return true;
}

export function isCorruptedNotes(noteContent: string): boolean {
  if (!noteContent || noteContent.length < 50) return false;
  return isCorruptedContent(noteContent);
}

export function sanitizeForDb(text: string): string {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/\0/g, "");
  clean = clean.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  clean = clean.replace(/\\u(?![0-9a-fA-F]{4})[^\s]*/g, "");
  clean = clean.replace(/\\(?![nrt\\/"ubf])/g, "");
  clean = clean.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "");
  clean = clean.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
  clean = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return clean.trim();
}

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  dataOffset: number;
}

function findZipEntries(data: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset < data.length - 4) {
    if (data[offset] === 0x50 && data[offset + 1] === 0x4B &&
        data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {
      const compressionMethod = data[offset + 8] | (data[offset + 9] << 8);
      const compressedSize = data[offset + 18] | (data[offset + 19] << 8) | (data[offset + 20] << 16) | (data[offset + 21] << 24);
      const uncompressedSize = data[offset + 22] | (data[offset + 23] << 8) | (data[offset + 24] << 16) | (data[offset + 25] << 24);
      const nameLength = data[offset + 26] | (data[offset + 27] << 8);
      const extraLength = data[offset + 28] | (data[offset + 29] << 8);
      const name = new TextDecoder().decode(data.subarray(offset + 30, offset + 30 + nameLength));
      const dataOffset = offset + 30 + nameLength + extraLength;
      entries.push({ name, compressedSize, uncompressedSize, compressionMethod, dataOffset });
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }
  return entries;
}

// Deno-compatible async decompression (replaces node:zlib inflateRawSync)
async function extractZipEntryAsync(data: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  if (entry.compressionMethod === 0) {
    return data.subarray(entry.dataOffset, entry.dataOffset + entry.uncompressedSize);
  } else if (entry.compressionMethod === 8) {
    try {
      const compressed = data.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(compressed);
      writer.close();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result;
    } catch (e) {
      console.error("Deflate decompression failed:", e);
      return null;
    }
  }
  return null;
}

async function extractDocxTextAsync(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    if (uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
      console.log("Not a valid ZIP/DOCX file");
      return "";
    }
    const entries = findZipEntries(uint8);
    let documentXml = "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    for (const entry of entries) {
      if (entry.name === "word/document.xml" || entry.name === "word\\document.xml") {
        const rawData = await extractZipEntryAsync(uint8, entry);
        if (rawData) documentXml = decoder.decode(rawData);
        break;
      }
    }
    if (!documentXml) {
      console.log("Could not find word/document.xml in DOCX");
      return "";
    }
    let text = documentXml;
    text = text.replace(/<\/w:p>/gi, "\n");
    text = text.replace(/<\/w:r>/gi, " ");
    text = text.replace(/<w:tab\/>/gi, "\t");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m: string, dec: string) => String.fromCharCode(parseInt(dec, 10)));
    text = text.replace(/[ \t]+/g, " ").replace(/\n +/g, "\n").replace(/\n{3,}/g, "\n\n");
    return text.trim();
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return "";
  }
}

function extractPdfTextRegex(rawText: string): string {
  const textParts: string[] = [];
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  while ((match = btEtRegex.exec(rawText)) !== null) {
    const textBlock = match[1];
    const parenRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = parenRegex.exec(textBlock)) !== null) {
      const decoded = strMatch[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1");
      if (decoded.trim()) textParts.push(decoded);
    }
    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(textBlock)) !== null) {
      const hex = hexMatch[1];
      let hexText = "";
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode < 127) hexText += String.fromCharCode(charCode);
      }
      if (hexText.trim()) textParts.push(hexText);
    }
  }
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

async function extractWithGemini(uint8Array: Uint8Array, title: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) { console.error("GEMINI_API_KEY not configured"); return ""; }
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);
  const ocrRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: "Extract ALL text content from this PDF document. Return every word, heading, paragraph, bullet point, table entry, and piece of text exactly as it appears. Preserve the document structure with headings and paragraphs. Do NOT add commentary, do NOT describe the document, do NOT summarize - just output the raw text content. If the document is completely blank or unreadable, respond with exactly one word: EXTRACTION_FAILED" },
          { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
        ]}],
        generationConfig: { maxOutputTokens: 16000 },
      }),
    },
  );
  if (!ocrRes.ok) { console.error("Gemini OCR failed:", ocrRes.status); return ""; }
  const ocrData = await ocrRes.json();
  return ocrData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
}

async function extractFromImage(uint8Array: Uint8Array, mimeType: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) { console.error("GEMINI_API_KEY not configured"); return ""; }
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const visionRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { text: "Extract ALL text content from this image. Include every word, number, heading, label, equation, table cell, and piece of text you can see. Preserve the structure and reading order. Do NOT add commentary, do NOT describe the image visually — just output the raw text content. If the image is completely blank or has no text, respond with exactly: EXTRACTION_FAILED" },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ]}],
            generationConfig: { maxOutputTokens: 8000 },
          }),
        },
      );
      if (!visionRes.ok) {
        if (attempt === 0 && (visionRes.status === 429 || visionRes.status >= 500)) {
          await new Promise(r => setTimeout(r, 1500)); continue;
        }
        return "";
      }
      const visionData = await visionRes.json();
      return visionData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    } catch (e) {
      if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return "";
    }
  }
  return "";
}

async function extractDocxWithOpenAI(uint8Array: Uint8Array, title: string, openaiKey: string): Promise<string> {
  const entries = findZipEntries(uint8Array);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const xmlParts: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith("word/") && entry.name.endsWith(".xml")) {
      try {
        const rawData = await extractZipEntryAsync(uint8Array, entry);
        if (rawData) {
          const xmlText = decoder.decode(rawData);
          let stripped = xmlText.replace(/<\/w:p>/gi, "\n").replace(/<\/w:r>/gi, " ").replace(/<[^>]+>/g, "");
          stripped = stripped.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
          stripped = stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
          if (stripped.length > 20) xmlParts.push(stripped);
        }
      } catch { /* skip */ }
    }
  }
  if (xmlParts.length === 0) return "";
  const rawContent = xmlParts.join("\n\n").substring(0, 30000);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a document text extractor. The user will provide raw text extracted from a Word document's XML. Clean it up into well-structured, readable text. Preserve all content, headings, lists, and structure. Do NOT summarize or add commentary." },
        { role: "user", content: `Document title: "${title}"\n\nRaw extracted text:\n${rawContent}` }
      ],
      max_tokens: 16000,
    }),
  });
  if (!res.ok) { console.error("OpenAI DOCX cleanup failed:", res.status); return ""; }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

interface ExtractionResult {
  content: string;
  method: "existing" | "regex" | "gemini_ocr" | "gemini_vision" | "text_file" | "docx_local" | "docx_openai";
  success: boolean;
  error?: string;
}

interface ExtractParams {
  supabase: any;
  doc: any;
  openaiKey: string;
}

export async function extractDocumentContent(params: ExtractParams): Promise<ExtractionResult> {
  const { supabase, doc, openaiKey } = params;

  if (doc.original_content && isQualityContent(doc.original_content)) {
    return { content: sanitizeForDb(doc.original_content), method: "existing", success: true };
  }

  if (!doc.storage_path) {
    if (doc.original_content && doc.original_content.length >= 20 && !isCorruptedContent(doc.original_content)) {
      return { content: sanitizeForDb(doc.original_content), method: "existing", success: true };
    }
    return { content: "", method: "existing", success: false, error: "No file or content available for this document." };
  }

  const { data: fileData, error: dlError } = await supabase.storage.from("documents").download(doc.storage_path);
  if (dlError || !fileData) {
    return { content: "", method: "existing", success: false, error: `Failed to download file: ${dlError?.message || "Unknown error"}` };
  }

  const fileExt = doc.storage_path.split(".").pop()?.toLowerCase();

  if (doc.source_type === "image" || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt || "")) {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const mimeType = fileExt === "jpg" || fileExt === "jpeg" ? "image/jpeg" : fileExt === "png" ? "image/png" : fileExt === "webp" ? "image/webp" : fileExt === "gif" ? "image/gif" : "image/png";
    const imageText = await extractFromImage(uint8Array, mimeType);
    if (imageText.trim() === "EXTRACTION_FAILED") {
      return { content: "", method: "gemini_vision", success: false, error: "We couldn't find any readable text in this image. Please upload a clearer image with visible text." };
    }
    if (imageText && imageText.trim().length >= 15 && !isCorruptedContent(imageText)) {
      return { content: sanitizeForDb(imageText), method: "gemini_vision", success: true };
    }
    return { content: "", method: "gemini_vision", success: false, error: "We couldn't extract readable text from this image. Try a clearer photo with better lighting." };
  }

  if (doc.source_type === "docx" || fileExt === "docx") {
    console.log("Extracting DOCX content...");
    if (fileData.size && fileData.size > 15 * 1024 * 1024) {
      return { content: "", method: "docx_local", success: false, error: "Document too long. Please upload a shorter document." };
    }
    const localText = await extractDocxTextAsync(fileData);
    console.log(`Local DOCX extraction: ${localText.length} chars`);
    if (localText && isQualityContent(localText)) {
      return { content: sanitizeForDb(localText.substring(0, 50000)), method: "docx_local", success: true };
    }
    console.log("Local DOCX extraction failed quality check, using OpenAI...");
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const aiText = await extractDocxWithOpenAI(uint8Array, doc.title, openaiKey);
    console.log(`OpenAI DOCX extraction: ${aiText.length} chars`);
    if (aiText && isQualityContent(aiText)) {
      return { content: sanitizeForDb(aiText.substring(0, 50000)), method: "docx_openai", success: true };
    }
    return { content: "", method: "docx_openai", success: false, error: "We couldn't extract readable text from this Word document. Please try saving it as PDF and re-uploading." };
  }

  if (fileExt === "pdf") {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    if (uint8Array.byteLength > 15 * 1024 * 1024) {
      return { content: "", method: "regex", success: false, error: "Document too long. Please upload a shorter document." };
    }
    const rawText = new TextDecoder("latin1").decode(uint8Array);
    if (rawText.length > 8_000_000) {
      return { content: "", method: "regex", success: false, error: "Document too long. Please upload a shorter document." };
    }
    const regexContent = extractPdfTextRegex(rawText);
    if (isQualityContent(regexContent)) {
      return { content: sanitizeForDb(regexContent.substring(0, 50000)), method: "regex", success: true };
    }
    const ocrContent = await extractWithGemini(uint8Array, doc.title);
    if (ocrContent.trim() === "EXTRACTION_FAILED") {
      return { content: "", method: "gemini_ocr", success: false, error: "We couldn't extract readable text from this PDF. Try uploading a clearer version." };
    }
    if (ocrContent && isQualityContent(ocrContent) && !isCorruptedContent(ocrContent)) {
      return { content: sanitizeForDb(ocrContent.substring(0, 50000)), method: "gemini_ocr", success: true };
    }
    return { content: "", method: "gemini_ocr", success: false, error: "We couldn't extract readable text from this PDF. Try uploading a clearer version." };
  }

  const rawBytes = new Uint8Array(await fileData.arrayBuffer());
  if (rawBytes[0] === 0x50 && rawBytes[1] === 0x4B) {
    console.log("Detected misclassified DOCX, re-extracting...");
    const { data: fileData2 } = await supabase.storage.from("documents").download(doc.storage_path);
    if (fileData2) {
      const localText = await extractDocxTextAsync(fileData2);
      if (localText && isQualityContent(localText)) {
        await supabase.from("documents").update({ source_type: "docx" }).eq("id", doc.id);
        return { content: sanitizeForDb(localText.substring(0, 50000)), method: "docx_local", success: true };
      }
      const ab = await fileData2.arrayBuffer();
      const u8 = new Uint8Array(ab);
      const aiText = await extractDocxWithOpenAI(u8, doc.title, openaiKey);
      if (aiText && isQualityContent(aiText)) {
        await supabase.from("documents").update({ source_type: "docx" }).eq("id", doc.id);
        return { content: sanitizeForDb(aiText.substring(0, 50000)), method: "docx_openai", success: true };
      }
    }
    return { content: "", method: "docx_local", success: false, error: "This file appears to be a Word document but couldn't be read. Try saving as PDF." };
  }

  const textContent = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes);
  if (textContent && textContent.trim().length >= 20 && isQualityContent(textContent)) {
    return { content: sanitizeForDb(textContent.substring(0, 50000)), method: "text_file", success: true };
  }
  return { content: "", method: "text_file", success: false, error: "The uploaded file appears to be empty or unreadable." };
}

export async function getValidatedContent(supabase: any, documentId: string, openaiKey: string): Promise<{ doc: any; content: string }> {
  const { data: doc, error: docError } = await supabase.from("documents").select("*").eq("id", documentId).single();
  if (docError || !doc) throw new Error("Document not found");
  if (doc.original_content && isQualityContent(doc.original_content) && !isCorruptedContent(doc.original_content)) {
    return { doc, content: sanitizeForDb(doc.original_content) };
  }
  console.log(`Document ${documentId} needs re-extraction...`);
  const result = await extractDocumentContent({ supabase, doc, openaiKey });
  if (!result.success) {
    throw new Error(result.error || "We couldn't read the text from this file. Please try re-uploading.");
  }
  const contentToSave = sanitizeForDb(result.content);
  await supabase.from("documents").update({
    original_content: contentToSave,
    source_type: result.method.startsWith("docx") ? "docx" : doc.source_type,
  }).eq("id", documentId);
  return { doc, content: contentToSave };
}
