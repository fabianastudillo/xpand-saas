import { getLocale, useLocale, type Locale, type TranslationVars } from "@xpand/ui";
import { useMemo } from "react";
import en from "./en.json";
import es from "./es.json";

/** Keys of the app's own texts. Spanish is the reference: en.json must carry the same keys (see messages.test). */
export type AppMessageKey = keyof typeof es;

/** A translator bound to one locale. Its identity changes with the locale, so memos can depend on it. */
export type Translate = (key: AppMessageKey, vars?: TranslationVars) => string;

type MessageCatalog = Readonly<Record<AppMessageKey, string>>;

const CATALOGS: Readonly<Record<Locale, MessageCatalog>> = { es, en };
const PLACEHOLDER = /\{(\w+)\}/g;

function format(message: string, vars: TranslationVars): string {
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(locale: Locale): Translate {
  return (key, vars = {}) => format(CATALOGS[locale][key], vars);
}

/** Translates in the active locale, outside React (used by the stores and the problem builders). */
export function appText(key: AppMessageKey, vars?: TranslationVars): string {
  return createTranslator(getLocale())(key, vars);
}

/** The translator of the active locale. A component using it re-renders, and gets a new translator, on a change. */
export function useAppText(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
