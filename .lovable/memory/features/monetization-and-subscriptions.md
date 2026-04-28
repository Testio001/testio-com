---
name: monetization-and-subscriptions
description: 4-tier pricing (Free/Basic/Pro/Scholar), Lemon Squeezy variant IDs, podcast top-up, and upload limits.
type: feature
---
## Plans (UI + manage-gamification backend)
- Free $0: 2 uploads (lifetime), 1 podcast (4 min, 8 exchanges), 5 tutor q's/doc, 20 quiz qs.
- Basic $4.99/mo: 15 uploads/mo, 3 podcasts (7 min, 14 exchanges), 21 tutor q's/doc.
- Pro $9.99/mo: 40 uploads/mo, 6 podcasts (12 min, 24 exchanges), 21 tutor q's/doc, unlimited quizzes, priority.
- Scholar $19.99/mo: "Unlimited" uploads (HARD CAP 80/mo for fair-use abuse prevention), 9 podcasts (15 min, 30 exchanges), unlimited tutor & quizzes, early access.

## Lemon Squeezy variant IDs (initialize-payment + verify-payment)
- basic: variant 1504464, product 957604
- pro: variant 1504491, product 957624
- scholar: variant 1537626, product 979773
- podcast_addon (top-up): variant 1519137, product 967498

## Podcast top-up
- Price: $4.99 for 5 podcast credits (was $2.99 — raised April 2026).
- Available to Basic / Pro / Scholar ONLY. Free users see upgrade CTAs instead.
- UI clearly states "Adds 5 podcast credits only (no other features)".
- Webhook adds 5 to user_stats.bonus_podcasts on order_created.

## Podcast generation cap
- generate-podcast clamps maxExchanges to [4, 30] regardless of client value.

## Korapay (Nigeria) — one-off payments
- Country detection: edge function `detect-country` uses ipapi.co. NG users default to NGN.
- Manual currency toggle on /pricing (USD ↔ NGN), persisted to `localStorage.testio_currency`.
- NGN prices (one-off, 30 days access): basic ₦7,800 · pro ₦14,990 · scholar ₦29,990.
- Edge functions: `korapay-initialize`, `korapay-verify`, `korapay-webhook` (verify_jwt=false on webhook).
- Webhook signature: HMAC SHA256 of `data` JSON with `KORAPAY_WEBHOOK_SECRET`, header `x-korapay-signature`.
- Tracking table: `korapay_transactions` (reference, plan, amount_ngn, status, expires_at).
- On success → sets `profiles.subscription_plan` + `subscription_expires_at = now()+30 days`. NO auto-renew.
- Webhook URL to register in Korapay dashboard: `https://kjdduozjlfhgznrcsoxr.supabase.co/functions/v1/korapay-webhook`
