import { isLocale, setLocale, type Locale } from "@xpand/ui";

const STORAGE_KEY = "xpand.locale";

/** The language the user chose, if it can be read. Storage can be blocked (private windows): then null. */
function savedLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    // Blocked storage is not an error for the user: the default language (Spanish) applies.
    return null;
  }
}

/** Applies the saved language at startup; without one, Spanish stays the default. */
export function restoreLocale(): void {
  const locale = savedLocale();
  if (locale !== null) setLocale(locale);
}

/** Remembers the language for the next visit; if storage is blocked the choice lasts for this page only. */
export function rememberLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Same as above: the language still changes for this page.
  }
}
