

## Plan: Replace AI-based text extraction with dedicated libraries

### Problem
After switching from `gpt-4o` to `gpt-4o-mini` for document extraction, PDF processing consistently fails. The `gpt-4o-mini` model is weaker at PDF file parsing via the vision/file API, causing documents to be marked as "failed."

### Solution

Replace the extraction pipeline in `supabase/functions/_shared/extract-content.ts` with dedicated libraries that run natively in Deno edge functions:

| File Type | Current Method | New Method |
|-----------|---------------|------------|
| **PDF** | Regex → gpt-4o-mini OCR fallback | Regex → **unpdf** (pdf.js-based, edge-compatible) |
| **DOCX** | Local ZIP/XML parsing → gpt-4o-mini fallback | Keep local ZIP/XML parsing (already works). Remove AI fallback — if local parsing fails, return clear error |
| **Images** | gpt-4o-mini vision | **Keep gpt-4o-mini vision** (Tesseract.js WASM is too heavy for edge functions and unreliable in Deno runtime — this is the one case where AI vision is the right tool) |

### Why not the exact libraries requested?
- **pdfplumber**: Python-only library, cannot run in Deno/JavaScript edge functions. **unpdf** is the equivalent — it wraps Mozilla's pdf.js optimized for edge runtimes and does the same text extraction.
- **Mammoth.js**: Node.js library that requires filesystem access. The current custom DOCX parser (ZIP → XML → text) already works well. If it doesn't extract properly, the issue is likely a corrupted file, not a parser problem.
- **Tesseract.js**: Requires loading ~15MB WASM binaries at runtime. Edge functions have strict memory/time limits, making this unreliable. gpt-4o-mini vision actually works well for image OCR — the failures are only with PDFs.

### Changes

**1. `supabase/functions/_shared/extract-content.ts`**
- Import `extractText, getDocumentProxy` from `unpdf` via esm.sh
- Replace `extractWithOpenAI()` function with a new `extractPdfWithUnpdf()` that uses unpdf's `extractText`
- Keep `extractPdfTextRegex()` as the fast first attempt
- Keep `extractFromImage()` using gpt-4o-mini vision (unchanged)
- Remove `extractDocxWithOpenAI()` — if local DOCX parsing fails, return an actionable error
- Update `ExtractionResult.method` types to include `"unpdf"`

**2. Deploy `process-document` edge function**

### Technical detail
```typescript
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12";

async function extractPdfWithUnpdf(uint8Array: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(uint8Array);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
```

This replaces the OpenAI API call entirely for PDFs — faster, cheaper, and more reliable.

