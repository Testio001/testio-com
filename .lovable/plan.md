## Problem

1. When a large/long PDF fails extraction, the edge function already returns a clear `"Document too long. Please upload a shorter document."` message — but the Dashboard `catch` block throws away that message and shows a generic "Couldn't process the document" toast. The user has no idea what went wrong.
2. After failure, the document still appears in the dashboard with status `failed`, and clicking it opens DocumentView where the Notes/Flashcards/Quiz/Podcast/Chat tabs still show their "Generate" buttons. Pressing them just produces more errors because there is no extracted content.

## Fix

### 1. Surface the real error from the edge function

In `src/pages/Dashboard.tsx` (and the equivalent text/image upload paths), parse the actual error returned by `process-document` instead of swallowing it.

- `supabase.functions.invoke` puts non-2xx responses on `fnError.context` (a `Response`). Read the JSON body, pull `error`, and fall back to a generic message only if missing.
- Use that message in the toast title/description so users see "Document too long. Please upload a shorter document." directly.
- Apply the same parsing to `handleTextUpload` and `handleImageUpload` (lines ~217, ~253, ~295).
- Add a small client-side guard: if a PDF file is larger than ~15 MB, reject before upload with the same "Document too long" message so we save the round-trip and storage write.

### 2. Stop failed documents from looking usable

**Dashboard list (`src/pages/Dashboard.tsx` ~line 571):**

- Failed cards: change cursor to default, remove the navigate-on-click behavior, and add a small "Re-upload" / "Delete" affordance in the existing dropdown menu so users can clean them up. Keep the red "failed" badge.

**DocumentView (`src/pages/DocumentView.tsx`):**

- When `doc.status === "failed"`, render a single full-width failure state (icon + "We couldn't process this document. It may be too long or unreadable. Please upload a shorter version." + "Back to dashboard" + "Delete document" buttons) instead of the tabs/feature panels.
- This removes every Generate button automatically, so users can no longer trigger doomed AI calls.

### 3.  Auto-cleanup

When the upload `catch` runs and we mark the row `failed`, also delete the orphaned file from the `documents` storage bucket so we don't pay for storage on unusable PDFs.

## Files to touch

- `src/pages/Dashboard.tsx` — error parsing, pre-upload size guard, failed-card UX, storage cleanup
- `src/pages/DocumentView.tsx` — failed-state screen replacing tabs

## Out of scope

- No edge-function changes (the "Document too long" error is already returned correctly).
- No schema changes.