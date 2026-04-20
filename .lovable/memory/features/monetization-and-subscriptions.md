---
name: monetization-and-subscriptions
description: 4-tier pricing (Free/Basic/Pro/Scholar), Lemon Squeezy variant IDs, podcast top-up, and upload limits.
type: feature
---
## Plans (UI + manage-gamification backend)
- Free $0: 3 uploads/mo, 1 podcast (4 min, 8 exchanges), 5 tutor q's/doc, 20 quiz qs.
- Basic $4.99/mo: 15 uploads/mo, 3 podcasts (7 min, 14 exchanges), 21 tutor q's/doc.
- Pro $9.99/mo: 40 uploads/mo, 6 podcasts (12 min, 24 exchanges), 21 tutor q's/doc, unlimited quizzes, priority.
- Scholar $14.99/mo: "Unlimited" uploads (HARD CAP 80/mo for fair-use abuse prevention), 9 podcasts (15 min, 30 exchanges), unlimited tutor & quizzes, early access.

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
