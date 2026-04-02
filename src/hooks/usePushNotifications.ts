import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedVapidPublicKey: string | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isiOS, setIsiOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsiOS(isIOSDevice);

    const isPWAMode = window.matchMedia('(display-mode: standalone)').matches ||
                      (navigator as any).standalone === true;
    setIsPWA(isPWAMode);

    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;

    if (isIOSDevice && !isPWAMode) {
      setIsSupported(false);
    } else {
      setIsSupported(hasServiceWorker && hasPushManager && hasNotification);
    }

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    checkSubscription();
  }, []);

  const getVapidPublicKey = useCallback(async () => {
    if (cachedVapidPublicKey) return cachedVapidPublicKey;

    const { data, error } = await supabase.functions.invoke('get-vapid-public-key');

    if (error) {
      throw new Error('Failed to load notification configuration');
    }

    const publicKey = data?.publicKey;

    if (!publicKey) {
      throw new Error('Notification public key is missing');
    }

    cachedVapidPublicKey = publicKey;
    return publicKey;
  }, []);

  const removeSubscriptionFromDatabase = useCallback(async (endpoint: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('push_subscriptions' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);
  }, []);

  const syncSubscriptionToDatabase = useCallback(async (subscription: PushSubscription) => {
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    if (!p256dhKey || !authKey) throw new Error('Failed to get subscription keys');

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('push_subscriptions' as any)
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;
  }, []);

  const checkSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      // Use the unified sw.js registration
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async (forceRefresh = false) => {
    if (!isSupported) throw new Error('Push notifications are not supported');
    setIsLoading(true);

    try {
      const currentPermission = Notification.permission;
      const perm = currentPermission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission denied');

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = await getVapidPublicKey();
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription && !forceRefresh) {
        await syncSubscriptionToDatabase(existingSubscription);
        setIsSubscribed(true);
        return;
      }

      if (existingSubscription) {
        await removeSubscriptionFromDatabase(existingSubscription.endpoint);
        await existingSubscription.unsubscribe();
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      await syncSubscriptionToDatabase(subscription);
      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }, [getVapidPublicKey, isSupported, removeSubscriptionFromDatabase, syncSubscriptionToDatabase]);

  const refreshSubscription = useCallback(async () => {
    await subscribe(true);
  }, [subscribe]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscriptionFromDatabase(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [removeSubscriptionFromDatabase]);

  return { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, refreshSubscription, unsubscribe };
}
