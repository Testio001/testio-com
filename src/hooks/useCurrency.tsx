import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "USD" | "NGN";

export const NGN_PRICES = {
  starter: 4490,
  basic: 7800,
  pro: 14990,
  scholar: 29990,
  podcast_addon: 7800,
} as const;

export const USD_PRICES = {
  // Starter is NGN-only — no USD price. Kept here so types align.
  starter: "—",
  basic: "$4.99",
  pro: "$9.99",
  scholar: "$19.99",
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
 * Returns the entry-level paid plan to market based on currency.
 * NGN visitors see Starter (₦4,490). Everyone else sees Basic ($4.99).
 */
export function entryPlanFor(currency: Currency): "starter" | "basic" {
  return currency === "NGN" ? "starter" : "basic";
}

/**
 * Returns the user's active display currency. Reads from localStorage,
 * else auto-detects via the detect-country edge function (NG => NGN).
 */
export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void; isNigeria: boolean } {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    const stored = localStorage.getItem("testio_currency");
    return stored === "NGN" || stored === "USD" ? (stored as Currency) : "USD";
  });
  const [isNigeria, setIsNigeria] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("detect-country", { body: {} });
        if (cancelled) return;
        const ng = data?.country === "NG";
        setIsNigeria(ng);
        if (ng) {
          // For Nigerian visitors, default to NGN unless they explicitly chose USD
          const stored = localStorage.getItem("testio_currency");
          if (stored !== "USD") {
            localStorage.setItem("testio_currency", "NGN");
            setCurrencyState("NGN");
          }
        } else {
          // Non-Nigerian visitors must always see USD pricing
          localStorage.setItem("testio_currency", "USD");
          setCurrencyState("USD");
        }
      } catch {
        // On failure, force USD for safety
        if (!cancelled) {
          setCurrencyState("USD");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = (c: Currency) => {
    // Block any attempt to use NGN if the visitor is not in Nigeria
    if (c === "NGN" && !isNigeria) return;
    localStorage.setItem("testio_currency", c);
    setCurrencyState(c);
  };

  return { currency, setCurrency, isNigeria };
}