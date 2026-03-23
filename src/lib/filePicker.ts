import { isNative } from '@/lib/platform';

interface PickedFile {
  file: File;
  name: string;
}

/**
 * Unified file picker. On native, uses Capacitor Filesystem.
 * On web, uses standard <input type="file">.
 */
export const pickFile = (accept: string): Promise<PickedFile | null> => {
  // Both native WebView and web browser support <input type="file">
  // The native file picker is triggered automatically by the WebView.
  // This wrapper exists for future native-specific enhancements.
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve({ file, name: file.name });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
};
