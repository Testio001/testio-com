import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "USD" | "NGN";

export const NGN_PRICES = {
  basic: 7800,
  pro: 14990,
  scholar: 22990,
  podcast_addon: 7800,
} as const;

export const USD_PRICES = {
  basic: "$4.99",
  pro: "$9.99",
  scholar: "$14.99",
  podcast_addon: "$4.99",
} as const;

export const formatNgn = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function priceFor(plan: keyof typeof NGN_PRICES, currency: Currency): string {
  if (currency === "NGN") return formatNgn(NGN_PRICES[plan]);
  return USD_PRICES[plan];
}

export function periodFor(currency: Currency): string {
  return currency === "NGN" ? "/30 days" : "/mo";
}

/**
 * Returns the user's active display currency. Reads from localStorage,
 * else auto-detects via the detect-country edge function (NG => NGN).
 */
export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void } {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    const stored = localStorage.getItem("testio_currency");
    return stored === "NGN" || stored === "USD" ? (stored as Currency) : "USD";
  });

  useEffect(() => {
    const stored = localStorage.getItem("testio_currency");
    if (stored === "NGN" || stored === "USD") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("detect-country", { body: {} });
        if (!cancelled && data?.country === "NG") {
          localStorage.setItem("testio_currency", "NGN");
          setCurrencyState("NGN");
        }
      } catch {
        // ignore — keep USD default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = (c: Currency) => {
    localStorage.setItem("testio_currency", c);
    setCurrencyState(c);
  };

  return { currency, setCurrency };
}