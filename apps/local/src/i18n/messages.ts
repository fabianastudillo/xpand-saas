import { getLocale, useLocale, type Locale, type TranslationVars } from "@xpand/ui";
import en from "./en.json";
import es from "./es.json";

/** Keys of the app's own texts. Spanish is the reference: en.json must carry the same keys (see messages.test). */
export type AppMessageKey = keyof typeof es;

type MessageCatalog = Readonly<Record<AppMessageKey, string>>;

const CATALOGS: Readonly<Record<Locale, MessageCatalog>> = { es, en };
const PLACEHOLDER = /\{(\w+)\}/g;

/** Translates an app text in the active locale. `{name}` placeholders take `vars`; unknown ones stay visible. */
export function appText(key: AppMessageKey, vars: TranslationVars = {}): string {
  const message = CATALOGS[getLocale()][key];
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export type TranslateFn = typeof appText;

/** Same translator, subscribed to the locale: a component using it re-renders when the language changes. */
export function useAppText(): TranslateFn {
  useLocale();
  return appText;
}
