"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLocale, localeCookieName, localeStorageKey, type Locale } from "./locale";
import { searchOsMutationRequestHeaders } from "../request-headers";
import { translate, type MessageKey, type MessageVariables } from "./translate";

export interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: (key: MessageKey, variables?: MessageVariables) => string;
  readonly formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  readonly formatDateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  readonly formatTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = window.localStorage.getItem(localeStorageKey);
    void (async () => {
      let next = isLocale(stored) ? stored : initialLocale;
      try {
        const response = await fetch("/api/preferences/locale", { cache: "no-store" });
        const preference = response.ok ? await response.json() as { locale?: unknown } : null;
        if (isLocale(preference?.locale)) next = preference.locale;
      } catch {
        // The cookie/localStorage mirror remains a safe fallback when the local runtime is unavailable.
      }
      if (active) {
        updateLocale(next);
        setInitialized(true);
      }
    })();
    return () => { active = false; };
  // Reconcile an existing browser mirror and durable local preference once after hydration.
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(localeStorageKey, locale);
    document.cookie = `${localeCookieName}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale]);

  useEffect(() => {
    if (!initialized) return;
    void fetch("/api/preferences/locale", {
      method: "POST",
      headers: { ...searchOsMutationRequestHeaders, "content-type": "application/json" },
      body: JSON.stringify({ locale })
    }).catch(() => undefined);
  }, [initialized, locale]);

  const setLocale = useCallback((nextLocale: Locale) => updateLocale(nextLocale), []);
  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key, variables) => translate(locale, key, variables),
    formatDate: (date, options) => new Intl.DateTimeFormat(locale, options ?? { year: "numeric", month: "short", day: "numeric" }).format(new Date(date)),
    formatDateTime: (date, options) => new Intl.DateTimeFormat(locale, options ?? { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)),
    formatTime: (date, options) => new Intl.DateTimeFormat(locale, options ?? { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(date))
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
