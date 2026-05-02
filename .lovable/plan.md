## Security audit — what's actually wrong

I scanned the backend (RLS, edge functions, storage, secrets, scanner findings). Here's the honest scorecard.

### ✅ Already correct (do not touch)

- **All user data tables** (`documents`, `notes`, `quizzes`, `flashcard_sets`, `chat_messages`, `folders`, `podcasts`, `referrals`, `user_stats SELECT`, `push_subscriptions`, `in_app_notifications`) — RLS is on and scoped by `auth.uid() = user_id`. Users **cannot** read each other's data.
- **Subscription plan, rate limits, bonus uploads, abuse flags** are stored on `profiles` / `user_stats` and `ai_usage_log` — `profiles` and `user_stats` have no client-writable column for `subscription_plan`/`bonus_uploads` *via dedicated policy*… **except** see issue #1 below.
- **Lemon Squeezy and Korapay** are called from edge functions only. Secrets (`LEMONSQUEEZY_API_KEY`, `KORAPAY_SECRET_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY`) live in Supabase secrets, never shipped to the browser.
- **Korapay webhook** double-verifies via the Korapay API, so a forged webhook cannot grant a subscription even if the signature secret is misconfigured. (Scanner flagged this but it's actually safe — I'll mark it fixed.)
- **AI rate limits** are enforced server-side via `check_ai_rate_limit` PG function reading `ai_usage_log` (which users cannot insert into — only service role can). Users **cannot** modify their rate limit.

### 🔴 Real issues to fix

**1. Profile self-upgrade vulnerability (CRITICAL)**
The `profiles` UPDATE policy is `auth.uid() = user_id` with no column restriction. A logged-in user can run:

```js
supabase.from('profiles').update({ subscription_plan: 'elite', subscription_expires_at: '2099-01-01' }).eq('user_id', myId)
```

…and instantly become an Elite subscriber, bypassing payment entirely.
**Fix:** Add a trigger that blocks changes to `subscription_plan` and `subscription_expires_at` unless the caller is `service_role`. Users can still update `display_name`. No UI breakage.

**2. AI edge functions accept anonymous calls (HIGH)**
`process-document`, `generate-notes`, `generate-quiz`, `generate-flashcards`, `generate-podcast` deploy with `verify_jwt = false` and never call `getClaims()`. Anyone with a document UUID can burn the owner's AI quota and overwrite their notes/quizzes.
**Fix:** Add JWT validation at the top of each function and verify `doc.user_id === caller.id` before processing. The frontend already sends the auth header via `supabase.functions.invoke`, so this won't break legitimate flows.

**3. Hardcoded admin code "4171" in client bundle (HIGH)**
`AdminCodeGate.tsx` ships `ACCESS_CODE = "4171"` to every visitor, and `admin-ops` accepts it as the only auth. Anyone can read it from the JS bundle and call admin-ops directly to read user lookups, modify streaks, and view dashboards.
**Fix:** Replace with proper role check — require the caller to be authenticated and have the `admin` role in `user_roles` (table already exists with `has_role()` function). Remove the constant from the client; gate the admin page by checking `has_role(auth.uid(), 'admin')`. You'll need your own user_id added to `user_roles` once — I'll provide an insert.
**⚠️ This will require you to be granted the admin role once before you can re-enter `/admin`. Confirm before I proceed.**

**4. `podcasts` storage bucket has a "public read" policy (MEDIUM)**
Even though the bucket is private, a leftover policy lets anyone with a file path stream any user's podcast.
**Fix:** Drop the `Public can read podcasts` storage policy. Signed URLs continue to work.

**5. Realtime channel leak on `user_stats` (MEDIUM)**
`user_stats` is published to Realtime with no channel-level RLS, so any authenticated user could subscribe and receive other users' stat updates (referral codes, abuse flags).
**Fix:** Add an RLS policy on `realtime.messages` restricting subscriptions to the user's own topic. App code already only subscribes to its own user, so no UI breakage.

**6. Edge functions leak internal error details (LOW)**
`process-document`, `generate-podcast`, etc., return raw Supabase/OpenAI error messages to the client.
**Fix:** Catch and return generic `"An internal error occurred"`; keep details in `console.error` only.

**7. Storage `documents` bucket missing UPDATE policy (LOW, defense-in-depth)**
**Fix:** Add an owner-scoped UPDATE policy on `storage.objects` for the `documents` bucket.

**8. RLS policies scoped to `public` instead of `authenticated` (LOW, hygiene)**
Many policies are evaluated against anonymous role even though `auth.uid()` is null then. Tightening the role makes intent explicit.
**Fix:** Recreate the affected policies with `TO authenticated`. Behaviour-equivalent — no UI breakage.

### ❓ Rate limiting (your question)

- **AI calls:** rate-limited per user in `check_ai_rate_limit` (10/hr free, 60/hr paid, 200/hr scholar). Tied to `user_id` from the document owner — not bypassable from the client.
- **No IP-based limit.** Lovable Cloud doesn't have first-class rate-limit primitives, and adding ad-hoc IP throttling can break shared-WiFi users (dorms, campuses). I recommend **leaving it user-based** unless you've actually seen abuse.
- **Login/signup:** abuse-checked by device fingerprint + email-domain blocklist (`check-signup-abuse`).

### Implementation order

1. Migration: profile self-upgrade trigger (#1) + storage update policy (#7) + drop public podcast policy (#4) + realtime RLS (#5) + tighten policies to `authenticated` (#8).
2. Edge functions: add JWT + ownership checks to 5 AI functions (#2), generic error responses (#6).
3. Admin: replace code-gate with role check on `admin-ops` and `AdminCodeGate.tsx` (#3) — **awaiting your go-ahead** because it locks you out until I insert your admin role.
4. Mark scanner findings resolved.
5. Admin is [Testimony.bankole@elizadeuniversity.edu.ng](mailto:Testimony.bankole@elizadeuniversity.edu.ng) 

### Question before I start

Items 1, 2, 4–8 are safe drop-ins (no UX change). **Item 3 (admin role gate)** requires me to grant your account the admin role via a one-line insert — tell me which email is yours so I add it in the same migration. Without that, you'd lose access to the admin dashboard until it's done.