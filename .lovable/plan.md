

## Hybrid Capacitor Logic (Web + Android Safe)

### Overview
Install Capacitor packages and add platform-aware logic so the app works identically on the web while gaining native Android capabilities (back button, background audio, push notifications, native file picker, safe area layout).

### What Will Be Done

#### 1. Install Dependencies
Add to `package.json`:
- `@capacitor/core`
- `@capacitor/cli` (dev)
- `@capacitor/app` (back button)
- `@capacitor/push-notifications`
- `@capacitor/filesystem` + a file picker approach (see technical details)

**Note on background audio**: The `@capawesome-team/capacitor-audio-player` plugin is a paid/premium plugin. Instead, we will use `@capgo/capacitor-native-audio` (free, supports background playback) on native, and keep the existing HTML5 `<audio>` on web.

#### 2. Platform Helper
Create `src/lib/platform.ts` — a thin utility exporting:
- `isNative()` — wraps `Capacitor.isNativePlatform()`
- `isAndroid()` / `isIOS()` checks

All native code paths will be guarded by these checks so the web build never calls native APIs.

#### 3. Android Back Button (`src/hooks/useBackButton.ts`)
- Only registers the `@capacitor/app` `backButton` listener when `isNative()` is true.
- Logic: if on `/` or `/dashboard`, call `App.exitApp()`. Otherwise `window.history.back()`.
- Hook is called once in `App.tsx`.

#### 4. Background Audio in PodcastPlayer
- Create `src/lib/audioPlayer.ts` with a unified `playStudyPodcast(url)` helper.
- **Native**: Uses `@capgo/capacitor-native-audio` with background mode.
- **Web**: Uses the existing HTML5 Audio API (no change to current behavior).
- Refactor `PodcastPlayer.tsx` to use this helper, keeping all existing UI/controls intact.

#### 5. Push Notifications (`src/hooks/usePushNotifications.ts`)
- On app load, if `isNative()`:
  - Request permission via `@capacitor/push-notifications`
  - Get FCM token and store it (console.log for now, can save to DB later)
- On web: no-op (silent skip).
- Hook is called in `App.tsx`.

#### 6. File Picker (`src/lib/filePicker.ts`)
- Create a unified `pickFile()` function.
- **Native**: Uses `@capacitor/filesystem` + native intent to pick files.
- **Web**: Programmatically clicks a hidden `<input type="file">` (current behavior).
- Update `Dashboard.tsx` `handleFileUpload` to use this unified function.

#### 7. Safe Area CSS
- Add CSS custom properties in `index.css` using `env(safe-area-inset-*)`.
- Apply padding to the app shell only when insets are > 0 (no visual change on web/desktop).

#### 8. Capacitor Config
- Run `npx cap init` to create `capacitor.config.ts` with:
  - `appId: "app.lovable.0128c3dafd054f2392b3fdd43a688e86"`
  - `appName: "testio-com"`
  - `server.url` pointing to the sandbox preview for dev hot-reload

#### 9. Service Worker Update
- Add `/~oauth` to a denylist so OAuth callbacks always hit the network (not cached).

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Add Capacitor dependencies |
| `capacitor.config.ts` | Create — Capacitor configuration |
| `src/lib/platform.ts` | Create — platform detection helper |
| `src/hooks/useBackButton.ts` | Create — Android back button hook |
| `src/lib/audioPlayer.ts` | Create — unified audio helper |
| `src/components/app/PodcastPlayer.tsx` | Modify — use audioPlayer helper on native |
| `src/hooks/usePushNotifications.ts` | Create — push notification registration |
| `src/lib/filePicker.ts` | Create — unified file picker |
| `src/pages/Dashboard.tsx` | Modify — use filePicker on native |
| `src/App.tsx` | Modify — add useBackButton + usePushNotifications hooks |
| `src/index.css` | Modify — add safe area CSS variables |
| `public/sw.js` | Modify — add `/~oauth` to denylist |

### No Design/CSS Changes
All existing styling remains untouched. Safe area padding is additive and invisible on web.

