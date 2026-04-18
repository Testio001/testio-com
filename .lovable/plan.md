

This is a massive request. Let me break it into atomic changes and present a focused plan. I'll explore key files first to ground the plan in reality.
<lov-tool-use id="toolu_vrtx_01Jnd9HbZq8cPSMNHysfMe1T" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/app/PodcastPlayer.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013LVxpDkKM7wo9v1Xgxho1U" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-podcast/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Vx9PGcwCxJWtkccezDrEJS" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/extract-content.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013F4kc8gsen9roi3rHMCPdu" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useGamification.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PTwd5XkEKfFuT7wCMeu3s2" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/process-document/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013d2HoT5XFQSfbfLU52GZmt" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/manage-gamification/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DUzhhuSNCV7ghpKo8bv5BA" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/DocumentView.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JSJAaYesCFqh6rCiLg7yP7" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-flashcards/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019cJyK1AVkUxYAWSLmuKwB6" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-quiz/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01P8UD5ijEjBi9fmAgi1aDei" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/app/PodcastPlayer.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EKKL5g73XU5jnVP9Avnhhe" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-podcast/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018BQnG7BL77TGMDaZLDyGvm" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/extract-content.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XdPk1MpZ4cLDmrgnTw4Y1m" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useGamification.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EUxiwrGKLLWwBpFErWEAqQ" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/process-document/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015oPBRT4enppm8wMcERXfHr" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/manage-gamification/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UYDhgApmmNfHKY9z4kpdT9" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-flashcards/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UAaBsbQdm1nRbMZKAT7vzR" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-quiz/index.ts\"}">
</lov-tool-use>
I have enough context to build a comprehensive plan. Let me check a couple more relevant files briefly.
<lov-tool-use id="toolu_vrtx_01MoibLn3wtEeXZvVeBqovQ8" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/DocumentView.tsx\", \"lines\": \"1-120\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019J7ZMEEdfrHCau4KDdQb4H" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Pricing.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>
I have enough context. Let me present the plan.

<lov-plan>

This is a large multi-area request. I'll group it into clear workstreams.

## 1. Podcast Player — fix root-cause seek bug

Current bug: `<audio src={blobUrl} ... />` with `blobUrl` in state ⇒ React re-renders and reassigns `src` on every state update (currentTime, playing, etc.), reloading audio and resetting to 0. The Blob fetch is also failing on signed URLs (CORS/expiry), per console logs.

Fixes in `src/components/app/PodcastPlayer.tsx`:
- Remove ALL Blob/`URL.createObjectURL` logic for playback (`loadAudioAsBlob`, `blobUrl` state, `blobUrlRef`).
- Set `src` once via `useEffect` + ref:
  ```ts
  useEffect(() => {
    if (audioRef.current && podcast?.audio_url) {
      audioRef.current.src = podcast.audio_url;
      audioRef.current.load();
    }
  }, [podcast?.audio_url]);
  ```
- Render `<audio ref={audioRef} preload="metadata" controlsList="nodownload" />` — NO `src` prop, NO conditional mount based on state.
- Memoize the player with `React.memo` and isolate currentTime updates so they don't cascade re-renders that touch the audio element.
- Keep Download MP3 button — it can fetch as blob ONLY when user clicks download (separate from playback).

In `supabase/functions/generate-podcast/index.ts`:
- Switch from `createSignedUrl` to **`getPublicUrl`** so the audio source is a stable, public, byte-range-supporting URL (already on `documents` bucket; ensure the file path is publicly readable — add a public read storage policy for `podcast_*.mp3` paths or move podcasts to a dedicated public bucket).
- Add a migration to create a public bucket `podcasts` (or add a public-read policy on `documents` for objects with prefix `*/podcast_*.mp3`).

## 2. Auto-generate notes on upload + auto-show on open

- After `process-document` succeeds, **invoke `generate-notes` automatically** (chained call) so summary exists immediately. Quizzes/flashcards/podcast/chat already depend on it.
- In `DocumentView.tsx`, when notes exist, default to the Notes tab (already does) and skip the "Generate Notes" button — it's already auto-shown. Add a fallback: if status=completed and no notes after 30s, show a one-click retry.

## 3. Podcast length per plan — fix "always longest"

Currently `generate-podcast` uses `maxExchanges` as a hard target, so a 2-page PDF still produces 24 exchanges of padded fluff (or short empty chunks).
- Change logic: `maxExchanges` becomes a CAP. Compute target exchanges from `sourceContent.length` (e.g., `Math.min(cap, Math.max(4, Math.floor(content.length / 600)))`).
- Pro user with tiny doc → naturally short podcast, but never above their cap.

## 4. Quiz/Flashcard caps + no repeats

- **Backend enforcement** in `generate-quiz` and `generate-flashcards`: load user's plan + count of existing questions/cards for that document. Block if Free user already has ≥20 quiz questions for the doc. Apply same per-plan rules for flashcards.
- **No repeats**: currently passes only last 30 existing fronts. Change to pass ALL existing fronts/questions (truncated by token budget) and add explicit "generate questions covering DIFFERENT subtopics than the list above" instruction. Also raise temperature slightly and pass `seed` variance.

## 5. Image/PPT/DOCX processing parity

`extract-content.ts` already uses Gemini 2.5 Flash Lite for PDFs and images. Issues:
- Image processing failing → confirm `extractFromImage` is being called from the main `extractDocumentContent` flow for `source_type === "image"`. Add explicit branch + better error messages.
- Add PPTX support: PPTX is also a ZIP. Reuse `findZipEntries` to extract `ppt/slides/slide*.xml` text, mirror the DOCX flow. Fall back to Gemini if local parsing fails.
- All visual extraction routes (PDF OCR, image, PPTX-with-images) → Gemini 2.5 Flash Lite. All text post-processing (notes, flashcards, quiz, chat) → GPT-4o-mini. Podcast TTS → gpt-4o-mini-audio-preview. (Already aligned; just close the image gap.)

## 6. Free plan = 3 uploads LIFETIME (not monthly)

- `manage-gamification`: remove any monthly reset for free uploads (none exists currently — `uploads_used` is already lifetime, just need to confirm and document). Update copy on Pricing/Home from "3 uploads / month" → "3 uploads (lifetime)".
- Same lifetime treatment for free podcast (1 lifetime).

## 7. Block re-signup abuse

- New table `account_history` with `email_hash`, `device_fingerprint` (optional), `last_plan`, `deleted_at`.
- On `delete-account`: insert hashed email into `account_history`.
- On signup (via DB trigger on `auth.users` insert OR in `handle_new_user`): if email hash exists in `account_history`, mark new profile with `subscription_plan = 'free'` AND `bonus_uploads = 0` AND set a flag `previously_deleted = true` on profiles so they don't get the "first 3 uploads" — they get 0 bonus credits. Show a banner: "Welcome back — your previous account history was preserved."

## 8. Seed streaks for current 22 users

- Migration: assign `current_streak` randomly 88–200 for the 22 existing users; set Bankole (testimony.bankole / find by email) to 321.
- Add `is_seeded_user boolean default false` on `user_stats`. Mark these 22 as seeded.
- Edge function (cron daily) auto-increments `current_streak` for seeded users regardless of upload activity.
- In Leaderboard view: for users with streak < 80, show message *"You're not in the Top 10,000 yet — keep studying to reach there."* instead of rank.

## 9. Smart Upgrade CTA tier escalation

In `UpgradePrompt.tsx` and any "Upgrade to Pro" CTAs:
- Free → Pro CTA (current behavior).
- Basic → Pro CTA (medium pressure).
- Pro → Scholar CTA (soft, low-pressure copy: *"Need more? Scholar unlocks 12 podcasts & unlimited tutor."*).
- Scholar → no upgrade CTA, show "You're on the top plan 👑".

## 10. "Elite Members" pricing banner

- Add to top of `Pricing.tsx`: *"Current rates locked for the first 1,000 'Elite' members. 997/1000 slots taken."* (static initially; can be backed by a `system_settings` row later.)
- Add a recurring banner component that appears every 5 minutes ONLY for free users on dashboard/document pages. Use `setInterval` + dismiss state.

## 11. "Did you know" tips

- Extend the rotating tips array in `ProcessingOverlay.tsx` and the recurring banner with: *"Did you know you can become a top student for less than the price of a weekly coffee?"* and similar value-prop tips.

## 12. Architecture summary (deliverable to user in chat after implementation)

I'll produce a clear breakdown of: upload pipeline → extraction (Gemini) → notes (GPT-4o-mini) → flashcards/quiz/chat (GPT-4o-mini using SUMMARY only) → podcast (gpt-4o-mini-audio-preview using full notes capped at 8K chars), exact token boundaries, and what's sent to each model on each click.

---

## Files to change

**Edit**: `src/components/app/PodcastPlayer.tsx`, `supabase/functions/generate-podcast/index.ts`, `supabase/functions/process-document/index.ts`, `supabase/functions/_shared/extract-content.ts` (PPTX + image fix), `supabase/functions/generate-flashcards/index.ts`, `supabase/functions/generate-quiz/index.ts`, `supabase/functions/manage-gamification/index.ts`, `supabase/functions/delete-account/index.ts`, `src/pages/Pricing.tsx`, `src/pages/Home.tsx`, `src/pages/DocumentView.tsx`, `src/pages/Dashboard.tsx`, `src/components/app/UpgradePrompt.tsx`, `src/components/app/Leaderboard.tsx`, `src/components/app/ProcessingOverlay.tsx`, `src/hooks/useGamification.tsx`.

**Create**: `src/components/app/ElitePricingBanner.tsx`, `src/components/app/RecurringUpsellBanner.tsx`, migration for `account_history` + `is_seeded_user` + storage public-read policy, migration for streak seeding, scheduled function `daily-streak-bump-seeded`.

## Open question

Could you confirm the **22 seeded user emails** (or should I select all current users in `profiles` ordered by `created_at` ascending limit 22)? And confirm Bankole's email to find his account.

