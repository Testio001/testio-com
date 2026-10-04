import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const KEY = "testio_push_prompt_last";
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

/**
 * Shown inside the installed app (PWA/TWA) when notifications aren't on yet:
 * on first launch, then again every 3 days. Never shown once allowed.
 */
export default function PushPermissionPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, isPWA, subscribe, isLoading } = usePushNotifications();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !isPWA || !isSupported) return;
    if (permission !== "default" && !(permission === "granted" && !isSubscribed)) return;
    if (permission === "granted" && isSubscribed) return;
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < THREE_DAYS) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [user, isPWA, isSupported, permission, isSubscribed]);

  const dismiss = () => {
    localStorage.setItem(KEY, String(Date.now()));
    setShow(false);
  };

  const allow = async () => {
    try {
      await subscribe();
      toast.success("Notifications turned on!");
      setShow(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not turn on notifications");
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg">
      <button onClick={dismiss} aria-label="Close" className="absolute right-3 top-3 text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="rounded-xl bg-primary/15 p-2"><Bell className="h-5 w-5 text-primary" /></div>
        <div>
          <p className="font-semibold text-foreground">Allow Testio AI to send notifications?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Get study reminders, referral sign-up alerts and creator reward updates.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={allow} disabled={isLoading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Allow
            </button>
            <button onClick={dismiss} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
