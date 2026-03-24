
## Permanent Fix Plan for the Upload/Text Extraction Problem

### What I found
This is not mainly an OCR problem. The biggest bug is **file-type handling**.

- Your recent entrepreneurship upload (`ENT 211- ENTERPRISE FORMATION`) is stored as a **`.docx` file**, but the app saved it as `source_type = "text"`.
- The backend then reads the `.docx` file like a plain text file, so it saves raw ZIP/XML package data such as:
  - `PK...`
  - `[Content_Types].xml`
  - `word/document.xml`
- That garbage is then treated as valid document text, which is why the AI generates summaries about **Word/XML document structure** instead of the actual entrepreneurship notes.
- I also confirmed that some old bad notes are already saved in the database, so other features can keep reusing polluted content even after upload succeeds.

### Root cause summary
1. **DOCX uploads are misclassified in the frontend**
   - `Dashboard.tsx` currently treats anything that isn’t PDF as `"text"`.
2. **DOCX extraction is missing in the backend**
   - `.docx` is being read as raw bytes instead of unpacked OOXML text.
3. **Quality checks are too weak for non-PDF files**
   - raw package/XML text can still pass and get saved.
4. **Bad notes contaminate later features**
   - flashcards, quiz, podcast, and chat may prefer existing notes, even when those notes were generated from corrupted source text.

---

## What I will implement

### 1. Fix upload classification at the source
Update the upload flow in `src/pages/Dashboard.tsx` so files are classified correctly:

- `pdf` → PDF pipeline
- `docx` → DOCX pipeline
- `txt/md` → plain text pipeline
- images → OCR/image pipeline
- `doc` → reject with a clear message instead of pretending it is supported

This removes the main cause of the corruption.

### 2. Add real DOCX extraction in the backend
Update `supabase/functions/_shared/extract-content.ts` to support Word documents properly by:

- detecting `.docx` from extension/storage path
- extracting text from the OOXML package (`word/document.xml`, and relevant supporting parts if needed)
- stripping XML tags/entities cleanly
- producing actual readable study content before saving

This is the permanent fix for the entrepreneurship file issue.

### 3. Harden the extraction quality gate
Expand validation so extracted content is rejected if it looks like:

- ZIP/package content (`PK...`)
- Office/XML internals (`[Content_Types].xml`, `_rels`, `word/document.xml`, `theme1.xml`)
- model apology/refusal text like “I’m unable to extract...”
- document-structure/meta summaries instead of source text

If content fails validation, the file should be marked `failed` with a clear error instead of being saved as `completed`.

### 4. Stop downstream features from reusing corrupted notes
Update these backend functions so they only use **validated** source material:

- `generate-notes`
- `generate-flashcards`
- `generate-quiz`
- `generate-podcast`
- `chat-with-notes`

Plan:
- prefer validated `original_content`
- ignore existing notes if those notes match the known corruption patterns
- regenerate from clean source instead of amplifying bad notes

### 5. Repair already-broken uploads automatically
Add a recovery path for existing bad records:

- detect documents whose saved content starts with ZIP/XML/package markers
- re-extract them from the original uploaded file
- overwrite bad `original_content`
- prevent old corrupted notes from being reused
- where needed, regenerate notes/derived content from the repaired source

This means you should not need to manually re-upload most affected `.docx` files.

### 6. Improve user-facing errors
Replace vague failures with clear messages such as:

- “This Word file format isn’t supported yet. Please upload a DOCX or PDF.”
- “We uploaded your file, but couldn’t extract readable study text from it.”
- “This document was repaired and is ready to generate notes again.”

---

## Files I would update
- `src/pages/Dashboard.tsx`
- `supabase/functions/_shared/extract-content.ts`
- `supabase/functions/process-document/index.ts`
- `supabase/functions/generate-notes/index.ts`
- `supabase/functions/generate-flashcards/index.ts`
- `supabase/functions/generate-quiz/index.ts`
- `supabase/functions/generate-podcast/index.ts`
- `supabase/functions/chat-with-notes/index.ts`

---

## What you need to do
For normal **PDF, DOCX, TXT, and image** uploads: **nothing** once this fix is implemented.

Only one case may still require your action:
- If your file is an old **`.doc`** Word file, please convert it to **`.docx` or PDF** before uploading. Legacy `.doc` is not reliable for this architecture.

For already broken uploads:
- I can plan the fix so the app **auto-repairs existing bad documents** from the original file in storage.
- You should only need to re-upload if the original file itself is unreadable or is a legacy `.doc`.

---

## Expected outcome
After this fix:

- DOCX files will use their **real document text**, not raw XML/package data
- notes will stop generating “Document Structure Overview” nonsense
- quiz/flashcards/podcast/chat will stop inheriting corrupted notes
- broken existing uploads can be repaired instead of starting over
- the feature becomes reliable enough to keep as a core part of the app
