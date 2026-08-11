import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight analytics event logger.
 * Writes to the `analytics_events` table; never throws (fire-and-forget).
 */
export async function trackEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await (supabase.from("analytics_events" as any) as any).insert({
      event_name: eventName,
      user_id: auth?.user?.id ?? null,
      metadata,
    });
  } catch {
    // analytics must never break the user flow
  }
}
