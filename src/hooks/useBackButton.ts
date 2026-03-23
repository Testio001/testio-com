import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNative } from '@/lib/platform';

export const useBackButton = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isNative()) return;

    let cleanup: (() => void) | undefined;

    const setup = async () => {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('backButton', () => {
        if (location.pathname === '/' || location.pathname === '/dashboard') {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
      cleanup = () => listener.remove();
    };

    setup();
    return () => cleanup?.();
  }, [location.pathname]);
};
