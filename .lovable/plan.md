

## Plan: Add Forgot Password + Email Notification System

### Part 1 — Forgot Password

**Problem:** No way to reset password from the sign-in page.

**Changes:**

1. **`src/pages/Auth.tsx`** — Add a "Forgot password?" link below the password field (visible only in login mode). On click, show an inline input that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })` and shows a toast confirmation.

2. **`src/pages/ResetPassword.tsx`** (new) — A public page at `/reset-password` that:
   - Detects `type=recovery` in the URL hash
   - Shows a "Set new password" form
   - Calls `supabase.auth.updateUser({ password })` on submit
   - Redirects to `/dashboard` on success

3. **`src/App.tsx`** — Add `/reset-password` route (public, not behind ProtectedRoute).

---

### Part 2 — Email Notification System

**Approach:** Use Lovable's built-in email infrastructure (domain `notify.testio.online` is already verified). Set up transactional email templates for event-triggered emails, and extend the existing `streak-reminder` pattern for the idle reminder.

**Infrastructure setup:**
- Call `setup_email_infra` to create database queue infrastructure
- Call `scaffold_transactional_email` to create the send Edge Function
- Create 6 email templates + register them

**Templates** (in `supabase/functions/_shared/transactional-email-templates/`):

| Template | Trigger | Deep-link |
|---|---|---|
| `welcome` | After signup (in Auth.tsx) | `/dashboard` |
| `idle-reminder` | Scheduled check (3 days no upload) | `/dashboard` |
| `badge-earned` | Badge awarded (manage-gamification) | `/dashboard` |
| `account-deleted` | After account deletion (delete-account) | `/` |
| `referral-success` | Referral processed (manage-gamification) | `/dashboard` |
| `credit-alert` | 2 of 3 uploads used (manage-gamification) | `/dashboard` |

**Styling:** Testio brand — white background, teal (#22c9a0) accent for buttons/headings, Space Grotesk font, matching existing auth email templates.

**Trigger wiring:**

1. **Welcome email** — In `Auth.tsx`, after successful signup, invoke `send-transactional-email` with `welcome` template.

2. **Idle reminder** — Modify existing `streak-reminder/index.ts` to also check for users with no upload in 3+ days and send the idle reminder via the transactional email system.

3. **Badge earned** — In `manage-gamification/index.ts`, after inserting a new badge, invoke `send-transactional-email` with `badge-earned` template.

4. **Account deleted** — In `delete-account/index.ts`, before deleting the user, capture their email, then after deletion send the confirmation email.

5. **Referral success** — In `manage-gamification/index.ts` `process-referral` case, after rewarding the referrer, send them a `referral-success` email.

6. **Credit alert** — In `manage-gamification/index.ts` `record-upload` case, after incrementing `uploads_used`, if `uploads_used === 2` (2 of 3 free used), send `credit-alert` email.

**Unsubscribe page** — Create `/unsubscribe` page as required by the transactional email system.

---

### Files Created/Modified

| File | Action |
|---|---|
| `src/pages/Auth.tsx` | Add forgot password link + welcome email trigger |
| `src/pages/ResetPassword.tsx` | New reset password page |
| `src/pages/Unsubscribe.tsx` | New unsubscribe page |
| `src/App.tsx` | Add `/reset-password` and `/unsubscribe` routes |
| `supabase/functions/_shared/transactional-email-templates/*.tsx` | 6 email templates |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Template registry |
| `supabase/functions/manage-gamification/index.ts` | Add email triggers for badge, referral, credit |
| `supabase/functions/delete-account/index.ts` | Add deletion confirmation email |
| `supabase/functions/streak-reminder/index.ts` | Add 3-day idle reminder |

