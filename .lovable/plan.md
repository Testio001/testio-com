
Goal: fix the document-to-notes pipeline so Testio always uses the uploaded file content, not PDF internals, titles, or hallucinated fallback text.

What I checked
- The problem is real and is mainly backend, not CSS/UI.
- Recent broken PDFs are marked `completed` while `original_content` is still `NULL`.
- Edge logs show the same root error repeatedly:
  - `Failed to update document with content: unsupported Unicode escape sequence`
- The current PDF extractor often treats raw PDF internals as “successful” text because it only checks length, so nonsense gets passed into note generation.
- `generate-flashcards` and `generate-quiz` still have dangerous fallbacks to `doc.title`, so the same class of bug can affect more than notes.
- `chat-with-notes` and `generate-podcast` depend on notes/content, so bad extraction contaminates those too.

Root causes
1. PDF extraction quality check is too weak  
   A long blob of PDF object/encoding text is accepted as valid content.
2. Saving extracted text is failing  
   The extracted string contains invalid characters/escape sequences, so DB writes fail.
3. Status handling is wrong  
   Documents can be marked `completed` even when extracted content was never saved.
4. Logic is duplicated across functions  
   `process-document` and `generate-notes` each do their own extraction/fallback, which makes bugs inconsistent.
5. Unsafe content fallbacks still exist  
   Quiz/flashcards can fall back to the document title and generate nonsense.

Implementation plan

1. Harden extraction at the source
- Refactor document extraction into a shared backend helper used by:
  - `process-document`
  - `generate-notes`
  - `generate-flashcards`
  - `generate-quiz`
  - `chat-with-notes`
  - `generate-podcast`
- Use a two-stage extraction flow:
  - Stage A: direct text extraction for real text PDFs/text files
  - Stage B: OCR/vision fallback when Stage A looks low-quality
- Replace the current “length > threshold” rule with a quality gate that rejects content dominated by:
  - PDF syntax (`obj`, `endobj`, `/Type`, `/Filter`, `/Catalog`, etc.)
  - unreadable symbol density
  - low word density / low natural-language score
  - repeated binary/encoding fragments

2. Sanitize extracted content before saving
- Add a backend sanitization step before every DB write:
  - strip null bytes
  - remove unsupported control characters
  - normalize Unicode
  - remove malformed escape patterns that break JSON/PostgREST payloads
- Save only sanitized content to `documents.original_content`.
- If sanitization leaves the content unusable, treat extraction as failed instead of pretending success.

3. Fix document status lifecycle
- `process-document` should only mark a document `completed` after content is successfully persisted.
- If extraction succeeds in memory but DB save fails, mark the document `failed` and store a user-safe error message.
- Avoid silent “completed + NULL content” states entirely.

4. Remove unsafe fallbacks across the study pipeline
- Remove `doc.title` fallback from:
  - `generate-flashcards`
  - `generate-quiz`
- Ensure all generators require one of:
  - validated `original_content`, or
  - validated notes content
- If no reliable content exists, return a friendly error instead of generating fake study material.

5. Make note generation use validated source content only
- Update `generate-notes` so it only proceeds with content that passed the shared extractor/quality gate.
- If extraction falls back to OCR, use the OCR result directly and persist it once.
- Prevent note generation from producing “data encoding / corrupted document” summaries unless the document truly is unreadable.

6. Improve error handling in the app
- Replace generic “edge function returned a non-2xx status code” messaging with clean, student-friendly errors such as:
  - “We couldn’t read the text from this file yet. Please try again or upload a clearer PDF/image.”
  - “This file uploaded successfully, but we couldn’t extract readable study content from it.”
- Surface processing failure clearly in the document status so users know whether the problem is upload, extraction, or generation.

7. Repair already-broken documents
- Add a recovery path for existing documents where:
  - `status = completed`
  - `original_content IS NULL`
- On next generation attempt, automatically re-run extraction with the new shared pipeline.
- Optionally backfill recent broken documents so users don’t need to re-upload.

8. QA all related flows, not just notes
- Test with:
  - a normal text PDF
  - a scanned/image PDF
  - a plain text upload
  - an image upload
  - a previously broken PDF
- Verify:
  - extracted content is saved
  - notes use actual file content
  - flashcards/quiz no longer use the title as source
  - chat/podcast use valid study content
  - failed files show clear status/messages

Files I would target
- `supabase/functions/process-document/index.ts`
- `supabase/functions/generate-notes/index.ts`
- `supabase/functions/generate-flashcards/index.ts`
- `supabase/functions/generate-quiz/index.ts`
- `supabase/functions/generate-podcast/index.ts`
- `supabase/functions/chat-with-notes/index.ts`
- new shared backend helper under `supabase/functions/_shared/`
- `src/pages/DocumentView.tsx`
- `src/pages/Dashboard.tsx`

Technical details
- Main confirmed backend bug: extracted text save fails with `unsupported Unicode escape sequence`.
- Main logic bug: the extractor currently accepts long garbage output as “good enough”, so OCR fallback is skipped when it should run.
- Main data integrity bug: documents can be `completed` while `original_content` is empty.
- Main cross-feature bug: quiz/flashcards still fall back to the document title, which spreads nonsense generation beyond notes.

Expected result
- Uploaded files become the single true source of generated study content.
- Broken PDFs either extract correctly through OCR or fail clearly.
- No more title-based or PDF-internals-based notes.
- Notes, flashcards, quiz, podcast, and chat all behave consistently because they share the same validated content pipeline.
