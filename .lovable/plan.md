## Plan: Fix Small-Screen Tabs, Add Gift Button, Show Real Usernames in Leaderboard

### Problem Summary

1. **DocumentView tabs** (Notes, Flashcards, Quiz, Podcast, Chat) require horizontal scrolling on small screens — users can't see all options.
2. **Dashboard navbar** has no gift/referral sharing button.
3. **Leaderboard** shows "Student" for users without a `display_name` instead of falling back to their email username.

---

### Changes

#### 1. DocumentView tabs — responsive grid on small screens

**File: `src/pages/DocumentView.tsx**`

- Replace the horizontal `flex gap-1 overflow-x-auto` tab bar with a responsive layout:
  - On small screens: use a 5-column grid (`grid grid-cols-5`) with icon-only buttons (no text labels), keeping all 5 tabs visible without scrolling.
  - On medium+ screens: keep current layout with icons + text labels.
- Each tab button will show only the icon on mobile, and icon + label on `sm:` and above.

#### 2. Dashboard navbar — add Gift button

**File: `src/pages/Dashboard.tsx**`

- Add a `Gift` icon button to the navbar (between StreakDisplay and Profile button).
- On click: trigger `navigator.share` with the user's referral link (from `gamification.getReferralLink()`), falling back to clipboard copy with a toast.

#### 3. Leaderboard — show real usernames

**File: `src/components/app/Leaderboard.tsx**`

- When fetching profiles, also select `email` alongside `display_name`.
- Fallback chain: `display_name` → email prefix (part before `@`) → `"Student"`.
- This ensures every leaderboard entry shows a meaningful name.
- &nbsp;
- &nbsp;
  Also make leaderboard also have its sperate page apart from the one in the dashboard and let the navigation to it show in the dashboard 

---

### Technical Details


| File                                 | Change                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `src/pages/DocumentView.tsx`         | Tab bar: icon-only on mobile via responsive classes, remove `overflow-x-auto` |
| `src/pages/Dashboard.tsx`            | Add `Gift` import, add share button in header nav                             |
| `src/components/app/Leaderboard.tsx` | Fetch `email` from profiles, use email prefix as fallback display name&nbsp; |
