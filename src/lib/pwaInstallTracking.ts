import { supabase } from "@/integrations/supabase/client";

const detectPlatform = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/windows/.test(ua)) return "windows";
  if (/mac os/.test(ua)) return "mac";
  return "other";
};

export const isRunningAsPWA = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true ||
  document.referrer.startsWith("android-app://");

/** Records the signed-in user as a PWA installer (once per session). */
export const recordPwaInstall = async (userId: string, email?: string | null) => {
  if (!isRunningAsPWA() && localStorage.getItem("testio-pwa-installed") !== "true") return;
  const key = `testio-pwa-recorded-${userId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  const { error } = await (supabase as any).rpc("record_pwa_install", {
    _email: email ?? null,
    _platform: detectPlatform(),
  });
  if (error) console.error("record_pwa_install failed", error);
};

// Remember the moment the browser reports a successful install
if (typeof window !== "undefined") {
  window.addEventListener("appinstalled", () => {
    localStorage.setItem("testio-pwa-installed", "true");
  });
}
