import { getLocale, type Locale } from "./store";

export interface FormatNumberOptions {
  /** Fixed number of decimals (padded and rounded). Default 1. */
  digits?: number;
  /** Defaults to the active locale. */
  locale?: Locale;
}

const DEFAULT_DIGITS = 1;
/** Shown when a value is not a finite number: the figure is unknown and we say so, never a 0. */
export const NOT_AVAILABLE = "—";

// Intl.NumberFormat construction is expensive; tables with ~1000 rows share one instance per locale/digits.
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: Locale, digits: number): Intl.NumberFormat {
  const cacheKey = `${locale}:${String(digits)}`;
  const cached = formatters.get(cacheKey);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // No thousands grouping: engineering figures (1457,8 MW) read better aligned than grouped.
    useGrouping: false,
    // A value that rounds to zero is shown as 0,0, never as -0,0.
    signDisplay: "negative",
  });
  formatters.set(cacheKey, formatter);
  return formatter;
}

/** Formats a figure with the decimal separator of the locale: 1457,8 (es) / 1457.8 (en). */
export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
  if (!Number.isFinite(value)) return NOT_AVAILABLE;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const locale = options.locale ?? getLocale();
  return formatterFor(locale, digits).format(value);
}
