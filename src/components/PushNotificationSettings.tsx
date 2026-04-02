import { useState } from "react";
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    isiOS,
    isPWA,
    subscribe,
    refreshSubscription,
    unsubscribe
  } = usePushNotifications();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const sendTestNotification = async () => {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: user.id,
            payload: {
              title: "Test Notification 🔔",
              body: "Push notifications are working on Testio!",
              url: "/dashboard"
            }
          }
        });

        if (error) throw error;
        return data as { sent?: number; total?: number } | null;
      };

      let result = await sendTestNotification();

      if ((result?.sent ?? 0) < 1) {
        await refreshSubscription();
        result = await sendTestNotification();
      }

      if ((result?.sent ?? 0) < 1) {
        throw new Error("Notification still wasn't delivered. Please wait a few seconds and try once more.");
      }

      toast.success("Test notification delivered!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success("Notifications disabled");
      } else {
        await subscribe(true);
        toast.success("Notifications enabled!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle notifications");
    }
  };

  if (isiOS && !isPWA) {
    return (
      <div className="bg-testio-card rounded-xl p-6">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Push Notifications
        </h3>
        <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg">
          <Smartphone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Install the app first</p>
            <ol className="text-xs text-muted-foreground mt-1 space-y-1 list-decimal list-inside">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Open the app from your home screen</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="bg-testio-card rounded-xl p-6">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Push Notifications
        </h3>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Not supported in this browser
        </p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="bg-testio-card rounded-xl p-6">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Push Notifications
        </h3>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Permission denied — update browser settings
        </p>
      </div>
    );
  }

  return (
    <div className="bg-testio-card rounded-xl p-6">
      <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
        {isSubscribed ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4" />}
        Push Notifications
      </h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground text-sm">
            {isSubscribed ? "Notifications enabled" : "Enable notifications"}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {isSubscribed ? "You'll receive study reminders" : "Get notified about streaks & reminders"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSubscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isSubscribed ? "Disable" : "Enable"}
        </button>
      </div>
      {isSubscribed && (
        <button
          onClick={handleSendTest}
          disabled={isSendingTest}
          className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-primary border border-primary/30 hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          {isSendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
          Send Test Notification
        </button>
      )}
    </div>
  );
}
