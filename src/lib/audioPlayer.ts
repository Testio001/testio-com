import { isNative } from '@/lib/platform';

/**
 * Unified audio player that uses native background audio on mobile
 * and HTML5 Audio on web.
 */
export const createAudioPlayer = (url: string): HTMLAudioElement => {
  // For now, both native and web use HTML5 Audio.
  // Native background audio plugin can be integrated later
  // when building the APK with Capacitor plugins.
  const audio = new Audio(url);
  return audio;
};

// On web, HTML5 Audio works fine. On native, Capacitor plugins
// handle background audio at the native layer. The HTML5 Audio
// element still works inside a WebView, so this is safe for both.
