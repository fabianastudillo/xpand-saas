import type { ComponentProps, ReactElement } from "react";
import { formatNumber, t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface NumberCellProps extends Omit<ComponentProps<"span">, "children"> {
  value: number;
  /** Unit shown after the figure, in muted ink: MW, MUS$, km… */
  unit?: string;
  /** Fixed decimals. Default 1. */
  digits?: number;
}

const DEFAULT_DIGITS = 1;

/**
 * A figure in IBM Plex Mono, right-aligned, with the decimal separator of the active locale.
 * Non-finite values render an em dash labelled «No disponible»: an unknown figure is never shown as 0.
 */
export function NumberCell({
  value,
  unit,
  digits = DEFAULT_DIGITS,
  className,
  ...props
}: NumberCellProps): ReactElement {
  const locale = useLocale();
  const isFinite = Number.isFinite(value);
  const figure = formatNumber(value, { digits, locale });
  return (
    <span
      data-slot="number-cell"
      className={cn("inline-block text-right font-mono tabular-nums text-ink", className)}
      aria-label={isFinite ? undefined : t("number.notAvailable")}
      {...props}
    >
      {isFinite ? <span>{figure}</span> : figure}
      {isFinite && unit ? (
        <>
          {" "}
          <span className="text-ink-muted">{unit}</span>
        </>
      ) : null}
    </span>
  );
}
