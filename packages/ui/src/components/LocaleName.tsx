import type { ComponentProps, ReactElement } from "react";
import { LOCALE_NAMES, type Locale } from "../i18n";

export interface LocaleNameProps extends Omit<ComponentProps<"span">, "children" | "lang"> {
  locale: Locale;
}

/** The name of a language in that language, with its `lang` attribute so it is pronounced correctly. */
export function LocaleName({ locale, ...props }: LocaleNameProps): ReactElement {
  return (
    <span data-slot="locale-name" lang={locale} {...props}>
      {LOCALE_NAMES[locale]}
    </span>
  );
}
