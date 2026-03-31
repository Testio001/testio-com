## Plan: Pricing & Subscription System with Paystack + TWA Detection

### Overview

Add a pricing page with two plans (Basic $4.99/mo, Pro $9.99/mo), integrate Paystack for payments, detect Android TWA to hide monetization UI, and track subscription status in the database.

---

### Step 1: Database Migration

Add `subscription_plan` and `subscription_expires_at` columns to the `profiles` table:

```sql
ALTER TABLE public.profiles
  ADD COLUMN subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_expires_at timestamptz;
```

This lets us check a user's plan everywhere in the app.

---

### Step 2: TWA Detection Utility

Create `src/hooks/useIsAndroidApp.ts` — a small hook that checks `document.referrer.includes('android-app://online.testio.twa')` and returns a boolean. All upgrade/pricing UI will be conditionally hidden when this returns `true`.

---

### Step 3: Pricing Page

Create `src/pages/Pricing.tsx` with two plan cards:


| Feature               | Testio Basic — $4.99/mo | Testio Pro — $9.99/mo    |
| --------------------- | ----------------------- | ------------------------ |
| Uploads               | 25/month                | Unlimited (100 soft cap) |
| Notes/Quiz/Flashcards | Yes                     | Yes                      |
| AI Tutor              | Standard                | Unlimited                |
| Podcast               | 5 min, 5/month          | Full length, 30/month    |


Each card has a "Subscribe Now" button that opens Paystack checkout popup. A note under Pro says "*Fair usage policy applies."

Add route `/pricing` to `App.tsx`.

---

### Step 4: Paystack Integration (Edge Function)

**Secret needed:** `PAYSTACK_SECRET_KEY` — will request from user via the secrets tool.

Create `supabase/functions/initialize-payment/index.ts`:

- Accepts `{ plan: 'basic' | 'pro' }` + JWT auth
- Calls Paystack Initialize Transaction API with the user's email and the correct amount (49900 or 99900 kobo — Paystack uses smallest currency unit)
- Returns the `authorization_url` for the popup

Create `supabase/functions/verify-payment/index.ts`:

- Called after Paystack popup closes with a reference
- Calls Paystack Verify Transaction API
- On success, updates `profiles.subscription_plan` and `subscription_expires_at` (30 days from now)

On the frontend, load Paystack inline JS and use the popup flow — no redirect needed.

---

### Step 5: Hide Monetization in TWA

Wrap the following in `{!isAndroidApp && ...}`:

- Upgrade buttons in `UpgradePrompt.tsx`
- Pricing link in navbar/settings
- Any "Subscribe" CTAs

---

### Step 6: Use Subscription Plan in App Logic

Update `Dashboard.tsx` upload limit logic: free = 3, basic = 25, pro = 100.
Update podcast generation to check plan for duration/count limits.

---

### Files Changed


| File                                             | Change                                                         |
| ------------------------------------------------ | -------------------------------------------------------------- |
| **Migration**                                    | Add `subscription_plan`, `subscription_expires_at` to profiles |
| `src/hooks/useIsAndroidApp.ts`                   | New — TWA detection hook                                       |
| `src/pages/Pricing.tsx`                          | New — pricing page with two plan cards                         |
| `src/App.tsx`                                    | Add `/pricing` route                                           |
| `supabase/functions/initialize-payment/index.ts` | New — Paystack init                                            |
| `supabase/functions/verify-payment/index.ts`     | New — Paystack verify + DB update                              |
| `src/components/app/UpgradePrompt.tsx`           | Hide when TWA, link upgrade to `/pricing`                      |
| `src/pages/Dashboard.tsx`                        | Adjust upload limits based on plan                             |


### Prerequisite

Will need the **Paystack Secret Key** added as a secret before the edge functions can work.

Also add a congratulations message when payment is successful and a message when payment is not 