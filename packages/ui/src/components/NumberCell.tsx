import type { ComponentProps, ReactElement } from "react";
import { formatNumber, t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface NumberCellProps extends Omit<ComponentProps<"span">, "children"> {
  value: number;
  /** Unit shown after the figure, in muted ink: MW, MUS$, km… */
  unit?: string;
  /** Spoken form of the unit when the abbreviation reads badly («MUS$» → «millones de dólares»). */
  unitLabel?: string;
  /** Fixed decimals. Default 1. */
  digits?: number;
}

const DEFAULT_DIGITS = 1;

/**
 * A figure in IBM Plex Mono with the decimal separator of the active locale.
 * Layout contract: the root is a block that fills its container (`block w-full text-right`), so inside a
 * <td>, a flex row or any flow container the figure sits on the right edge whatever the parent's alignment.
 * Figure and unit never wrap apart. Non-finite values render an em dash for sighted users and
 * «No disponible» for screen readers: an unknown figure is never shown as 0.
 */
export function NumberCell({
  value,
  unit,
  unitLabel,
  digits = DEFAULT_DIGITS,
  className,
  ...props
}: NumberCellProps): ReactElement {
  const locale = useLocale();
  const hasValue = Number.isFinite(value);
  const figure = formatNumber(value, { digits, locale });
  return (
    <span
      data-slot="number-cell"
      className={cn("block w-full text-right font-mono tabular-nums whitespace-nowrap text-ink", className)}
      {...props}
    >
      {hasValue ? (
        <>
          <span>{figure}</span>
          {unit ? <Unit unit={unit} unitLabel={unitLabel} /> : null}
        </>
      ) : (
        <>
          <span aria-hidden="true">{figure}</span>
          <span className="xp-sr-only">{t("number.notAvailable")}</span>
        </>
      )}
    </span>
  );
}

function Unit({ unit, unitLabel }: { unit: string; unitLabel: string | undefined }): ReactElement {
  if (unitLabel === undefined) {
    return (
      <>
        {" "}
        <span className="text-ink-muted">{unit}</span>
      </>
    );
  }
  return (
    <>
      {" "}
      <span aria-hidden="true" className="text-ink-muted">
        {unit}
      </span>
      <span className="xp-sr-only">{unitLabel}</span>
    </>
  );
}
