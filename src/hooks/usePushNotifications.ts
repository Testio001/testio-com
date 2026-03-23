import { useEffect } from 'react';
import { isNative } from '@/lib/platform';

export const usePushNotifications = () => {
  useEffect(() => {
    if (!isNative()) return;

    const setup = async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        console.log('FCM Token:', token.value);
        // TODO: Save token to database for server-side push
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error:', err);
      });
    };

    setup();
  }, []);
};
