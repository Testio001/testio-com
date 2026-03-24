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
];

/**
 * Checks if content looks like raw DOCX/ZIP internals or AI refusal text.
 */
function isCorruptedContent(text: string): boolean {
  if (!text || text.length < 20) return false;
  const sample = text.substring(0, 3000);

  // Check for DOCX/ZIP internals
  let docxHits = 0;
  for (const pattern of DOCX_CORRUPTION_PATTERNS) {
    if (pattern.test(sample)) docxHits++;
  }
  if (docxHits >= 2) return true;

  // Check for AI refusal / meta-description text
  for (const pattern of AI_REFUSAL_PATTERNS) {
    if (pattern.test(sample)) return true;
  }

  // Check if starts with ZIP magic bytes
  if (sample.startsWith("PK")) return true;

  return false;
}

/**
 * Checks if extracted text is real natural language vs PDF internals/garbage.
 */
export function isQualityContent(text: string): boolean {
  if (!text || text.length < 50) return false;

  // First check for known corruption patterns
  if (isCorruptedContent(text)) return false;

  const sample = text.substring(0, 5000);

  // Count PDF syntax markers
  let junkHits = 0;
  for (const pattern of PDF_JUNK_PATTERNS) {
    const matches = sample.match(pattern);
    junkHits += matches?.length || 0;
  }

  const wordCount = sample.split(/\s+/).length;
  if (wordCount > 0 && junkHits / wordCount > 0.05) return false;

  // Check for natural language
  const words = sample.split(/\s+/).filter(w => w.length >= 2);
  const readableWords = words.filter(w => /^[a-zA-Z0-9.,;:!?'"()\-\u00C0-\u024F]+$/.test(w));
  if (words.length > 0 && readableWords.length / words.length < 0.4) return false;

  // Reject if too many non-printable / control characters
  const nonPrintable = (sample.match(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g) || []).length;
  if (nonPrintable / sample.length > 0.15) return false;

  return true;
}

/**
 * Checks if existing notes content is corrupted (generated from bad source).
 */
export function isCorruptedNotes(noteContent: string): boolean {
  if (!noteContent || noteContent.length < 50) return false;
  return isCorruptedContent(noteContent);
}

/**
 * Sanitizes text for safe database storage.
 */
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

/**
 * Extract text from a DOCX file (OOXML format).
 * DOCX is a ZIP containing XML files. We extract word/document.xml and strip tags.
 */
async function extractDocxText(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Verify ZIP magic bytes
    if (uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
      console.log("Not a valid ZIP/DOCX file");
      return "";
    }

    // Find word/document.xml in the ZIP
    // ZIP files have a central directory at the end; we'll search for the local file headers
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const entries = findZipEntries(uint8);

    let documentXml = "";
    for (const entry of entries) {
      if (entry.name === "word/document.xml" || entry.name === "word\\document.xml") {
        const rawData = extractZipEntry(uint8, entry);
        if (rawData) {
          documentXml = decoder.decode(rawData);
        }
        break;
      }
    }

    if (!documentXml) {
      console.log("Could not find word/document.xml in DOCX");
      return "";
    }

    // Extract text from the XML
    // Remove all XML tags but preserve paragraph breaks
    let text = documentXml;
    // Add newlines for paragraph boundaries
    text = text.replace(/<\/w:p>/gi, "\n");
    // Add space for text run boundaries
    text = text.replace(/<\/w:r>/gi, " ");
    // Add tab for tab elements
    text = text.replace(/<w:tab\/>/gi, "\t");
    // Remove all remaining XML tags
    text = text.replace(/<[^>]+>/g, "");
    // Decode XML entities
    text = text.replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)));
    // Clean up whitespace
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n +/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return "";
  }
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
    // Local file header signature: PK\x03\x04
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

      // Move to next entry
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }

  return entries;
}

function extractZipEntry(data: Uint8Array, entry: ZipEntry): Uint8Array | null {
  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return data.subarray(entry.dataOffset, entry.dataOffset + entry.uncompressedSize);
  } else if (entry.compressionMethod === 8) {
    // Deflate - use DecompressionStream
    try {
      return decompressDeflateSync(data.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize));
    } catch (e) {
      console.error("Deflate decompression failed:", e);
      return null;
    }
  }
  return null;
}

function decompressDeflateSync(compressed: Uint8Array): Uint8Array {
  // Use a simple approach: try to use the raw deflate data
  // In Deno, we can use DecompressionStream
  // But since we need sync, we'll use a manual approach for the edge function
  // Actually, Deno supports DecompressionStream but it's async
  // For edge functions, let's use a workaround with Response + DecompressionStream
  throw new Error("DEFLATE_NEEDS_ASYNC");
}

async function extractZipEntryAsync(data: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  if (entry.compressionMethod === 0) {
    return data.subarray(entry.dataOffset, entry.dataOffset + entry.uncompressedSize);
  } else if (entry.compressionMethod === 8) {
    try {
      const compressed = data.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      // Wrap raw deflate in a proper stream
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) {
        result.set(c, off);
        off += c.length;
      }
      return result;
    } catch (e) {
      console.error("Async deflate decompression failed:", e);
      return null;
    }
  }
  return null;
}

/**
 * Async DOCX extraction that handles compressed entries.
 */
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
        if (rawData) {
          documentXml = decoder.decode(rawData);
        }
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
    text = text.replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m: string, dec: string) => String.fromCharCode(parseInt(dec, 10)));
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n +/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  } catch (e) {
    console.error("DOCX async extraction error:", e);
    return "";
  }
}

/**
 * Extract text from PDF using regex (for text-based PDFs).
 */
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

/**
 * Use OpenAI to extract text from a PDF file (OCR/vision fallback).
 */
async function extractWithOpenAI(uint8Array: Uint8Array, title: string, openaiKey: string): Promise<string> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);

  const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract ALL text content from this PDF document. Include every word, heading, paragraph, bullet point, and piece of text. Preserve the structure. Do NOT summarize - extract the raw text." },
          { type: "file", file: { filename: `${title}.pdf`, file_data: `data:application/pdf;base64,${pdfBase64}` } },
        ],
      }],
      max_tokens: 16000,
    }),
  });

  if (!ocrRes.ok) {
    console.error("OpenAI OCR failed:", ocrRes.status, await ocrRes.text());
    return "";
  }

  const ocrData = await ocrRes.json();
  return ocrData.choices?.[0]?.message?.content || "";
}

/**
 * Use OpenAI Vision to extract text from an image.
 */
async function extractFromImage(uint8Array: Uint8Array, mimeType: string, openaiKey: string): Promise<string> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract ALL text content from this image. Include every word, number, heading, label, and piece of text you can see. Preserve the structure and formatting as much as possible." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
      max_tokens: 4096,
    }),
  });

  if (!visionRes.ok) {
    console.error("Vision API error:", await visionRes.text());
    return "";
  }

  const visionData = await visionRes.json();
  return visionData.choices?.[0]?.message?.content || "";
}

/**
 * Use OpenAI to extract text from a DOCX when local parsing fails.
 */
async function extractDocxWithOpenAI(uint8Array: Uint8Array, title: string, openaiKey: string): Promise<string> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const docxBase64 = btoa(binary);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract ALL text content from this Word document (.docx). Include every word, heading, paragraph, bullet point, and piece of text. Preserve the structure. Do NOT summarize or describe the file format - extract only the actual document text content." },
          { type: "file", file: { filename: `${title}.docx`, file_data: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}` } },
        ],
      }],
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI DOCX extraction failed:", res.status, await res.text());
    return "";
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

interface ExtractionResult {
  content: string;
  method: "existing" | "regex" | "openai_ocr" | "openai_vision" | "text_file" | "docx_local" | "docx_openai";
  success: boolean;
  error?: string;
}

interface ExtractParams {
  supabase: any;
  doc: any;
  openaiKey: string;
}

/**
 * Main extraction function. Gets validated content from a document,
 * using multiple strategies with quality gates.
 */
export async function extractDocumentContent(params: ExtractParams): Promise<ExtractionResult> {
  const { supabase, doc, openaiKey } = params;

  // 1. Check if existing original_content is valid (and not corrupted)
  if (doc.original_content && isQualityContent(doc.original_content)) {
    return { content: sanitizeForDb(doc.original_content), method: "existing", success: true };
  }

  // 2. No valid content - need to extract from file
  if (!doc.storage_path) {
    if (doc.original_content && doc.original_content.length >= 20 && !isCorruptedContent(doc.original_content)) {
      return { content: sanitizeForDb(doc.original_content), method: "existing", success: true };
    }
    return { content: "", method: "existing", success: false, error: "No file or content available for this document." };
  }

  // 3. Download file from storage
  const { data: fileData, error: dlError } = await supabase.storage.from("documents").download(doc.storage_path);
  if (dlError || !fileData) {
    return { content: "", method: "existing", success: false, error: `Failed to download file: ${dlError?.message || "Unknown error"}` };
  }

  const fileExt = doc.storage_path.split(".").pop()?.toLowerCase();

  // 4. Handle images
  if (doc.source_type === "image" || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt || "")) {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const mimeType = fileExt === "jpg" || fileExt === "jpeg" ? "image/jpeg" : fileExt === "png" ? "image/png" : fileExt === "webp" ? "image/webp" : "image/png";

    const imageText = await extractFromImage(uint8Array, mimeType, openaiKey);
    if (imageText && isQualityContent(imageText)) {
      return { content: sanitizeForDb(imageText), method: "openai_vision", success: true };
    }
    return { content: "", method: "openai_vision", success: false, error: "Could not extract readable text from this image." };
  }

  // 5. Handle DOCX files
  if (doc.source_type === "docx" || fileExt === "docx") {
    console.log("Extracting DOCX content...");

    // Stage A: Local OOXML parsing
    const localText = await extractDocxTextAsync(fileData);
    console.log(`Local DOCX extraction: ${localText.length} chars`);

    if (localText && isQualityContent(localText)) {
      return { content: sanitizeForDb(localText.substring(0, 50000)), method: "docx_local", success: true };
    }

    // Stage B: OpenAI fallback for DOCX
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

  // 6. Handle PDFs - two stage
  if (fileExt === "pdf") {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const rawText = new TextDecoder("latin1").decode(uint8Array);

    const regexContent = extractPdfTextRegex(rawText);
    console.log(`Regex PDF extraction: ${regexContent.length} chars`);

    if (isQualityContent(regexContent)) {
      return { content: sanitizeForDb(regexContent.substring(0, 50000)), method: "regex", success: true };
    }

    console.log("Regex extraction failed quality check, using OpenAI OCR...");
    const ocrContent = await extractWithOpenAI(uint8Array, doc.title, openaiKey);
    console.log(`OpenAI OCR extraction: ${ocrContent.length} chars`);

    if (ocrContent && isQualityContent(ocrContent)) {
      return { content: sanitizeForDb(ocrContent.substring(0, 50000)), method: "openai_ocr", success: true };
    }

    return { content: "", method: "openai_ocr", success: false, error: "We couldn't extract readable text from this PDF. Try uploading a clearer version." };
  }

  // 7. Handle text files - but check if it's actually a misclassified DOCX
  const rawBytes = new Uint8Array(await fileData.arrayBuffer());
  if (rawBytes[0] === 0x50 && rawBytes[1] === 0x4B) {
    // This is actually a ZIP/DOCX file misclassified as text
    console.log("Detected misclassified DOCX (ZIP signature found), re-extracting as DOCX...");
    // Re-download since we consumed the blob
    const { data: fileData2 } = await supabase.storage.from("documents").download(doc.storage_path);
    if (fileData2) {
      const localText = await extractDocxTextAsync(fileData2);
      if (localText && isQualityContent(localText)) {
        // Fix the source_type for future
        await supabase.from("documents").update({ source_type: "docx" }).eq("id", doc.id);
        return { content: sanitizeForDb(localText.substring(0, 50000)), method: "docx_local", success: true };
      }

      // Try OpenAI fallback
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

/**
 * Gets validated content for a document, to be used by any generator function.
 * If original_content is missing/bad, re-extracts and saves.
 */
export async function getValidatedContent(supabase: any, documentId: string, openaiKey: string): Promise<{ doc: any; content: string }> {
  const { data: doc, error: docError } = await supabase.from("documents").select("*").eq("id", documentId).single();
  if (docError || !doc) throw new Error("Document not found");

  // Check if existing content is valid AND not corrupted
  if (doc.original_content && isQualityContent(doc.original_content) && !isCorruptedContent(doc.original_content)) {
    return { doc, content: sanitizeForDb(doc.original_content) };
  }

  // Need to re-extract
  console.log(`Document ${documentId} has no valid content (or content is corrupted), re-extracting...`);
  const result = await extractDocumentContent({ supabase, doc, openaiKey });

  if (!result.success) {
    throw new Error(result.error || "We couldn't read the text from this file. Please try re-uploading a clearer PDF, DOCX, or image.");
  }

  // Save the extracted content back
  const contentToSave = sanitizeForDb(result.content);
  const { error: saveError } = await supabase.from("documents").update({
    original_content: contentToSave,
    source_type: result.method.startsWith("docx") ? "docx" : doc.source_type,
  }).eq("id", documentId);

  if (saveError) {
    console.error("Failed to save re-extracted content:", saveError.message);
  }

  return { doc, content: contentToSave };
}
