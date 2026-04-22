import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached: Promise<string> | null = null;

/**
 * Returns a stable device fingerprint hash. Cached for the page lifetime.
 * Used for anti-abuse checks (preventing repeated free-trial signups on the same device).
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    } catch {
      // Fallback: best-effort browser signature
      const sig = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
      ].join("|");
      // Simple hash
      let h = 0;
      for (let i = 0; i < sig.length; i++) {
        h = (h << 5) - h + sig.charCodeAt(i);
        h |= 0;
      }
      return "fb_" + Math.abs(h).toString(36);
    }
  })();
  return cached;
}