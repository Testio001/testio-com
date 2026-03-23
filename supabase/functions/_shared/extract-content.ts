// Shared content extraction helper for all edge functions
// Provides quality gating, sanitization, and OCR fallback

const PDF_JUNK_PATTERNS = [
  /\bobj\b/g, /\bendobj\b/g, /\/Type\b/g, /\/Filter\b/g, /\/Catalog\b/g,
  /\/Page\b/g, /\/Font\b/g, /\/Length\b/g, /\/FlateDecode\b/g,
  /\/Resources\b/g, /\/MediaBox\b/g, /\/Contents\b/g, /\/Subtype\b/g,
  /\/BaseFont\b/g, /\/Encoding\b/g, /stream\b/g, /endstream\b/g,
  /xref\b/g, /trailer\b/g, /startxref\b/g, /%PDF-/g,
];

/**
 * Checks if extracted text is real natural language vs PDF internals/garbage.
 * Returns true if the content passes quality checks.
 */
export function isQualityContent(text: string): boolean {
  if (!text || text.length < 50) return false;

  const sample = text.substring(0, 5000);

  // Count PDF syntax markers
  let junkHits = 0;
  for (const pattern of PDF_JUNK_PATTERNS) {
    const matches = sample.match(pattern);
    junkHits += matches?.length || 0;
  }

  // If more than 5% of words are PDF syntax, it's junk
  const wordCount = sample.split(/\s+/).length;
  if (wordCount > 0 && junkHits / wordCount > 0.05) return false;

  // Check for natural language: at least 60% printable ASCII words >= 2 chars
  const words = sample.split(/\s+/).filter(w => w.length >= 2);
  const readableWords = words.filter(w => /^[a-zA-Z0-9.,;:!?'"()\-\u00C0-\u024F]+$/.test(w));
  if (words.length > 0 && readableWords.length / words.length < 0.4) return false;

  // Reject if too many non-printable / control characters
  const nonPrintable = (sample.match(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g) || []).length;
  if (nonPrintable / sample.length > 0.15) return false;

  return true;
}

/**
 * Sanitizes text for safe database storage.
 * Removes null bytes, invalid Unicode escape sequences, and control characters.
 */
export function sanitizeForDb(text: string): string {
  if (!text) return "";

  let clean = text;

  // Remove null bytes
  clean = clean.replace(/\0/g, "");

  // Remove other control characters except newline, carriage return, tab
  clean = clean.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Fix malformed Unicode escape sequences that break PostgREST/JSON
  // Remove \uXXXX patterns that aren't valid
  clean = clean.replace(/\\u(?![0-9a-fA-F]{4})[^\s]*/g, "");

  // Remove lone backslashes before characters that aren't valid escape chars
  clean = clean.replace(/\\(?![nrt\\/"ubf])/g, "");

  // Remove surrogate pairs that are incomplete
  clean = clean.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "");
  clean = clean.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

  // Normalize whitespace
  clean = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return clean.trim();
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
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (decoded.trim()) textParts.push(decoded);
    }
    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(textBlock)) !== null) {
      const hex = hexMatch[1];
      let hexText = "";
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode < 127) {
          hexText += String.fromCharCode(charCode);
        }
      }
      if (hexText.trim()) textParts.push(hexText);
    }
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Use OpenAI to extract text from a PDF file (OCR/vision fallback).
 */
async function extractWithOpenAI(
  uint8Array: Uint8Array,
  title: string,
  openaiKey: string
): Promise<string> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);

  const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text content from this PDF document. Include every word, heading, paragraph, bullet point, and piece of text. Preserve the structure. Do NOT summarize - extract the raw text.",
            },
            {
              type: "file",
              file: {
                filename: `${title}.pdf`,
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
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
async function extractFromImage(
  uint8Array: Uint8Array,
  mimeType: string,
  openaiKey: string
): Promise<string> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text content from this image. Include every word, number, heading, label, and piece of text you can see. Preserve the structure and formatting as much as possible.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
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

interface ExtractionResult {
  content: string;
  method: "existing" | "regex" | "openai_ocr" | "openai_vision" | "text_file";
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
 * 
 * Returns sanitized, quality-validated content ready for DB storage and AI use.
 */
export async function extractDocumentContent(
  params: ExtractParams
): Promise<ExtractionResult> {
  const { supabase, doc, openaiKey } = params;

  // 1. Check if existing original_content is valid
  if (doc.original_content && isQualityContent(doc.original_content)) {
    return {
      content: sanitizeForDb(doc.original_content),
      method: "existing",
      success: true,
    };
  }

  // 2. No valid content - need to extract from file
  if (!doc.storage_path) {
    // Text-only document with no file
    if (doc.original_content && doc.original_content.length >= 20) {
      return {
        content: sanitizeForDb(doc.original_content),
        method: "existing",
        success: true,
      };
    }
    return {
      content: "",
      method: "existing",
      success: false,
      error: "No file or content available for this document.",
    };
  }

  // 3. Download file from storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from("documents")
    .download(doc.storage_path);

  if (dlError || !fileData) {
    return {
      content: "",
      method: "existing",
      success: false,
      error: `Failed to download file: ${dlError?.message || "Unknown error"}`,
    };
  }

  const fileType = doc.storage_path.split(".").pop()?.toLowerCase();

  // 4. Handle images
  if (doc.source_type === "image" || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileType || "")) {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const mimeType =
      fileType === "jpg" || fileType === "jpeg"
        ? "image/jpeg"
        : fileType === "png"
        ? "image/png"
        : fileType === "webp"
        ? "image/webp"
        : "image/png";

    const imageText = await extractFromImage(uint8Array, mimeType, openaiKey);
    if (imageText && isQualityContent(imageText)) {
      return {
        content: sanitizeForDb(imageText),
        method: "openai_vision",
        success: true,
      };
    }
    return {
      content: "",
      method: "openai_vision",
      success: false,
      error: "Could not extract readable text from this image.",
    };
  }

  // 5. Handle PDFs - two stage
  if (fileType === "pdf") {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const rawText = new TextDecoder("latin1").decode(uint8Array);

    // Stage A: regex extraction
    const regexContent = extractPdfTextRegex(rawText);
    console.log(`Regex PDF extraction: ${regexContent.length} chars`);

    if (isQualityContent(regexContent)) {
      return {
        content: sanitizeForDb(regexContent.substring(0, 50000)),
        method: "regex",
        success: true,
      };
    }

    // Stage B: OpenAI OCR fallback
    console.log("Regex extraction failed quality check, using OpenAI OCR...");
    const ocrContent = await extractWithOpenAI(uint8Array, doc.title, openaiKey);
    console.log(`OpenAI OCR extraction: ${ocrContent.length} chars`);

    if (ocrContent && isQualityContent(ocrContent)) {
      return {
        content: sanitizeForDb(ocrContent.substring(0, 50000)),
        method: "openai_ocr",
        success: true,
      };
    }

    // Both stages failed
    return {
      content: "",
      method: "openai_ocr",
      success: false,
      error:
        "We couldn't extract readable text from this PDF. It may be a scanned document with poor quality. Try uploading a clearer version.",
    };
  }

  // 6. Handle text files
  const textContent = await fileData.text();
  if (textContent && textContent.trim().length >= 20) {
    return {
      content: sanitizeForDb(textContent.substring(0, 50000)),
      method: "text_file",
      success: true,
    };
  }

  return {
    content: "",
    method: "text_file",
    success: false,
    error: "The uploaded file appears to be empty or unreadable.",
  };
}

/**
 * Gets validated content for a document, to be used by any generator function.
 * If original_content is missing/bad, re-extracts and saves.
 * Returns the content string or throws with a user-friendly message.
 */
export async function getValidatedContent(
  supabase: any,
  documentId: string,
  openaiKey: string
): Promise<{ doc: any; content: string }> {
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    throw new Error("Document not found");
  }

  // Check if existing content is valid
  if (doc.original_content && isQualityContent(doc.original_content)) {
    return { doc, content: sanitizeForDb(doc.original_content) };
  }

  // Need to re-extract
  console.log(`Document ${documentId} has no valid content, re-extracting...`);
  const result = await extractDocumentContent({ supabase, doc, openaiKey });

  if (!result.success) {
    throw new Error(
      result.error ||
        "We couldn't read the text from this file. Please try re-uploading a clearer PDF or image."
    );
  }

  // Save the extracted content back to the document
  const { error: saveError } = await supabase
    .from("documents")
    .update({ original_content: result.content })
    .eq("id", documentId);

  if (saveError) {
    console.error("Failed to save re-extracted content:", saveError.message);
    // Content is still usable in memory even if save fails
  }

  return { doc, content: result.content };
}
