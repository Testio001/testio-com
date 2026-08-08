import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "USD" | "NGN";

type CountryCode = "NG" | "OTHER";

const CURRENCY_KEY = "testio_currency";
const COUNTRY_KEY = "testio_country";
const CURRENCY_EVENT = "testio-currency-change";

let countryDetectionPromise: Promise<CountryCode> | null = null;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 4500): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("Country detection timed out")), timeoutMs)),
  ]);
};

const normalizeCountry = (value: unknown): CountryCode | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().toUpperCase() === "NG" ? "NG" : "OTHER";
};

const detectCountry = (): Promise<CountryCode> => {
  if (countryDetectionPromise) return countryDetectionPromise;

  countryDetectionPromise = (async () => {
    // Prefer browser-side detection because the request definitely originates
    // from the visitor rather than an edge-function relay.
    const providers = [
      { url: "https://ipapi.co/json/", read: (data: any) => data?.country_code },
      { url: "https://ipwho.is/", read: (data: any) => data?.country_code },
    ];

    for (const provider of providers) {
      try {
        const response = await withTimeout(fetch(provider.url, { headers: { Accept: "application/json" } }));
        if (!response.ok) continue;
        const country = normalizeCountry(provider.read(await response.json()));
        if (country) return country;
      } catch {
        // Try the next independent provider.
      }
    }

    try {
      const { data, error } = await withTimeout(supabase.functions.invoke("detect-country", { body: {} }));
      if (!error) {
        const country = normalizeCountry(data?.country);
        if (country) return country;
      }
    } catch {
      // The safe final fallback below keeps non-Nigerian pricing restricted.
    }

    // Never expose Naira checkout when Nigeria cannot be confirmed.
    return "OTHER";
  })();

  return countryDetectionPromise;
};

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
export function useCurrency(): {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  isNigeria: boolean;
  isCurrencyLoading: boolean;
} {
  const cachedCountry = typeof window !== "undefined" ? localStorage.getItem(COUNTRY_KEY) : null;
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    if (cachedCountry !== "NG") return "USD";
    const sessionChoice = sessionStorage.getItem(CURRENCY_KEY);
    return sessionChoice === "USD" ? "USD" : "NGN";
  });
  const [isNigeria, setIsNigeria] = useState(cachedCountry === "NG");
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(cachedCountry === null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const country = await detectCountry();
      if (cancelled) return;

      const ng = country === "NG";
      localStorage.setItem(COUNTRY_KEY, country);
      setIsNigeria(ng);

      const sessionChoice = sessionStorage.getItem(CURRENCY_KEY);
      const nextCurrency: Currency = ng && sessionChoice === "USD" ? "USD" : ng ? "NGN" : "USD";
      if (!ng) sessionStorage.removeItem(CURRENCY_KEY);
      setCurrencyState(nextCurrency);
      setIsCurrencyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncCurrency = (event: Event) => {
      const nextCurrency = (event as CustomEvent<Currency>).detail;
      if (nextCurrency === "USD" || nextCurrency === "NGN") setCurrencyState(nextCurrency);
    };
    window.addEventListener(CURRENCY_EVENT, syncCurrency);
    return () => window.removeEventListener(CURRENCY_EVENT, syncCurrency);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    // Block any attempt to use NGN if the visitor is not in Nigeria
    if (c === "NGN" && !isNigeria) return;
    sessionStorage.setItem(CURRENCY_KEY, c);
    setCurrencyState(c);
    window.dispatchEvent(new CustomEvent<Currency>(CURRENCY_EVENT, { detail: c }));
  }, [isNigeria]);

  return { currency, setCurrency, isNigeria, isCurrencyLoading };
}