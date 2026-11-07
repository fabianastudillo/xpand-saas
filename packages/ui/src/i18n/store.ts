import { useSyncExternalStore } from "react";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = "es";

// The one piece of mutable state in the package: the active locale, shared by t() and the React hook.
let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Active locale, readable outside React (formatters, t()). */
export function getLocale(): Locale {
  return currentLocale;
}

/** Changes the active locale and notifies every subscriber. Throws on an unsupported value. */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${String(locale)}. Expected one of ${LOCALES.join(", ")}.`);
  }
  if (locale === currentLocale) return;
  currentLocale = locale;
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribes the component to the active locale, so it re-renders when setLocale is called. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
