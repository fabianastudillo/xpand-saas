import en from "./en.json";
import es from "./es.json";
import { getLocale, type Locale } from "./store";

export {
  LOCALES,
  LOCALE_NAMES,
  getLocale,
  isLocale,
  setLocale,
  subscribeLocale,
  useLocale,
  type Locale,
} from "./store";
export { formatNumber, type FormatNumberOptions } from "./number";

/** Every key of the Spanish catalog; en.json is checked to have the same set. */
export type MessageKey = keyof typeof es;
export type TranslationVars = Readonly<Record<string, string | number>>;

const CATALOGS: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { es, en };

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(message: string, vars: TranslationVars): string {
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

function missingKey(key: string): string {
  // Vite and Vitest define `import.meta.env`; webpack (the Next app) does not: there a missing key renders itself.
  if (import.meta.env?.DEV === true) {
    throw new Error(`Missing i18n key "${key}" for locale "${getLocale()}".`);
  }
  return key;
}

/**
 * Translates a key in the active locale. `{name}` placeholders are replaced from `vars`; unknown ones stay
 * visible. A missing key throws in development and renders the key itself in production.
 */
export function t(key: MessageKey, vars?: TranslationVars): string {
  const message = CATALOGS[getLocale()][key];
  if (message === undefined) return missingKey(key);
  return vars ? interpolate(message, vars) : message;
}
