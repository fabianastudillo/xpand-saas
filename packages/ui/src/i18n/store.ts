import { useSyncExternalStore } from "react";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language named in itself. Render with `lang={locale}` (see <LocaleName>) so it is read correctly. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { es: "Español", en: "English" };

const DEFAULT_LOCALE: Locale = "es";

// The one piece of mutable state in the package: the active locale, shared by t() and the React hook.
let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Keeps <html lang> in step with the locale so screen readers switch pronunciation. */
function syncDocumentLang(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
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
  syncDocumentLang(locale);
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

syncDocumentLang(DEFAULT_LOCALE);
