import { Button, LOCALES, LocaleName, setLocale, useLocale } from "@xpand/ui";
import type { ReactElement } from "react";
import { rememberLocale } from "../i18n/locale";
import { useAppText } from "../i18n/messages";

/** The language choice, in the top bar's settings slot: each language is named in itself. */
export function LocaleSwitch(): ReactElement {
  const locale = useLocale();
  const translate = useAppText();
  return (
    <div role="group" aria-label={translate("language.label")} className="flex items-center gap-1">
      {LOCALES.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === locale ? "secondary" : "ghost"}
          aria-pressed={option === locale}
          onClick={() => {
            setLocale(option);
            rememberLocale(option);
          }}
        >
          <LocaleName locale={option} />
        </Button>
      ))}
    </div>
  );
}
