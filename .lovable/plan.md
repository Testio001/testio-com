

## Optimization Plan for Testio

### Assessment: What's Already Done vs. Needs Work

| Area | Status | Notes |
|------|--------|-------|
| Podcast TTS at API level | Done | Edge function already handles `maxExchanges` |
| 3-min cliffhanger cut-off | Done | Already in `generate-podcast` edge function |
| Separate StreakDisplay/ReferralCard components | Done | Already atomic components |
| RLS on all gamification tables | Done | Properly configured |
| Basic error handling with toasts | Partially done | Needs cleanup in some flows |
| Streak/referral logic on backend | NOT done | All in frontend `useGamification.tsx` |
| Database indexes | NOT done | No indexes on lookup columns |
| Race condition protection | NOT done | Double uploads can break streak |
| Optimistic UI updates | NOT done | UI waits for backend |
| Console.log cleanup | NOT done | `console.error` calls in Dashboard.tsx and ChatPanel.tsx |
| GamificationSidebar double-hook issue | NOT done | Both Dashboard and Sidebar call `useGamification()` separately |

---

### What Will Be Implemented

#### 1. New Edge Function: `manage-gamification`

Move all heavy logic from `useGamification.tsx` into a single edge function with action-based routing:

- **`record-upload`**: Handles streak calculation, bonus upload checks, badge awarding, and race condition prevention (checks `last_upload_date` server-side before incrementing)
- **`process-referral`**: Validates referral code, checks monthly limits, awards bonuses — all atomically on the server
- **`get-stats`**: Returns user stats, badges, and referrals in one call
- **`check-streak`**: Handles streak freeze consumption and streak breaking logic

The frontend `useGamification.tsx` will become a thin wrapper that calls these endpoints and manages local state.

#### 2. Database Migration: Indexes

Add indexes for fast lookups:
- `user_stats(referral_code)` — used during referral validation
- `user_stats(last_upload_date)` — used for streak checks
- `referrals(referrer_user_id)` — used for referral count queries
- `user_stats(current_streak DESC)` — used by leaderboard

#### 3. Race Condition Fix

In the `record-upload` edge function action, use a database-level check:
- Read `last_upload_date` inside the function
- If it equals today, skip streak increment but still count the upload
- This prevents double-counting even if the user clicks upload twice rapidly

#### 4. Optimistic UI Updates

In `Dashboard.tsx`, when a user uploads:
- Immediately increment the streak counter in local state before the API responds
- Show the updated streak in `StreakDisplay` instantly
- If the backend returns an error, roll back the optimistic state

#### 5. Refactor GamificationSidebar

Remove the independent `useGamification()` call from `GamificationSidebar`. Instead, pass gamification data as props from `Dashboard` (which already has the hook). This eliminates duplicate API calls and duplicate state.

#### 6. Console Cleanup

Remove `console.error` calls from:
- `src/pages/Dashboard.tsx` (3 occurrences)
- `src/components/app/ChatPanel.tsx` (1 occurrence)

Keep `console.error` in edge functions (server-side logging is fine).

#### 7. Error Handling Polish

- Invalid referral code: show "This referral code doesn't exist. Double-check and try again."
- OpenAI TTS failure: show "Podcast generation failed. Please try again in a moment."
- Network errors: show "Connection issue. Check your internet and try again."

All via toast notifications, no crashes.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/manage-gamification/index.ts` | Create — new edge function |
| `supabase/config.toml` | Add function config |
| `src/hooks/useGamification.tsx` | Refactor — thin API wrapper |
| `src/components/app/GamificationSidebar.tsx` | Refactor — receive props instead of own hook |
| `src/pages/Dashboard.tsx` | Add optimistic updates, pass props to sidebar, remove console.error |
| `src/components/app/ChatPanel.tsx` | Remove console.error |
| DB migration | Add 4 indexes |

### No CSS/Design Changes

All changes are backend plumbing and performance-focused.

