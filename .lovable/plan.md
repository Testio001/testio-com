

## Plan: Fix Push Notifications for Android PWA

### Problem
Push notifications don't work on Android PWA because:
1. Two competing service workers (`sw.js` and `sw-push.js`) fight for root scope
2. The push service worker is only registered when the user clicks "Enable" — Android needs it registered at app startup to receive background pushes
3. A React runtime error (`useState` null) may be blocking the app from loading

### Solution

**Merge service workers into a single `sw.js`** that handles both caching AND push events, then register it once at app startup.

---

### Step 1: Merge push handlers into `public/sw.js`
Add the `push`, `notificationclick`, and `notificationclose` event listeners from `sw-push.js` into the existing `sw.js`. Remove `sw-push.js` as a separate file.

### Step 2: Update `src/main.tsx` — register SW at startup
Register `/sw.js` once on load. Remove the duplicate registration from `index.html` inline script. Add the iframe/preview guard so the SW doesn't interfere in the Lovable editor.

### Step 3: Update `src/hooks/usePushNotifications.ts`
- Change all references from `/sw-push.js` to `/sw.js`
- On `subscribe()`, use `navigator.serviceWorker.ready` instead of re-registering a separate SW
- On `checkSubscription()`, use `navigator.serviceWorker.ready` to get the active registration

### Step 4: Fix the React runtime error
The `useState` null error in `ThemeProvider` is likely caused by duplicate React instances. Check `vite.config.ts` — the `react()` plugin (from `@vitejs/plugin-react`) may conflict with something. This may also be a transient preview-only issue; verify after the SW fixes.

### Step 5: Update `public/manifest.json`
Ensure `"start_url": "/"` and `"display": "standalone"` are set (already correct). No changes needed.

### Step 6: Deploy edge function
Redeploy `send-push-notification` to ensure it's live with the current VAPID keys.

---

### Files Changed

| File | Change |
|------|--------|
| `public/sw.js` | Add push/notification event handlers from sw-push.js |
| `public/sw-push.js` | Delete (merged into sw.js) |
| `src/main.tsx` | Single SW registration with preview guard, remove duplicate |
| `index.html` | Remove inline SW registration script |
| `src/hooks/usePushNotifications.ts` | Reference `/sw.js`, use `navigator.serviceWorker.ready` |

### Why This Fixes Android
Android PWA requires the service worker to be registered and active **before** a push event arrives. By merging into `sw.js` and registering at startup, the push handler is always listening — even when the app is in the background or closed. The native-style notification (not Chrome icon) comes from having proper `icon` and `badge` fields plus `display: standalone` in the manifest.

