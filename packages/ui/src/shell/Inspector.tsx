import { useId, type ReactElement, type ReactNode } from "react";
import { NumberCell } from "../components/NumberCell";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface InspectorProps {
  /** What is selected or focused: «Barra 2». Without it the heading is just «Propiedades». */
  title?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * The right zone: properties and help of the selected element (unit, limits, default). Empty state when
 * nothing is selected. Property rows go in <InspectorRows>; editable fields (later) can be siblings.
 */
export function Inspector({ title, children, className }: InspectorProps): ReactElement {
  useLocale();
  const headingId = useId();
  const heading = title === undefined ? t("shell.inspector.title") : `${t("shell.inspector.title")} · ${title}`;
  return (
    <div data-slot="inspector" role="group" aria-labelledby={headingId} className={cn("flex flex-col gap-3 p-3", className)}>
      <h2 id={headingId} className="xp-label">
        {heading}
      </h2>
      {children ?? <p className="text-sm text-ink-muted">{t("shell.inspector.empty")}</p>}
    </div>
  );
}

/** A description list of property rows. */
export function InspectorRows({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <dl data-slot="inspector-rows" className={cn("m-0 flex flex-col gap-1", className)}>
      {children}
    </dl>
  );
}

export interface InspectorRowProps {
  label: ReactNode;
  /** A number is formatted as a figure (Plex Mono, locale decimal separator); anything else as given. */
  value: ReactNode;
  unit?: string;
  digits?: number;
}

/** Label on the left, value on the right; figures carry their unit («Pd 340,0 MW»). */
export function InspectorRow({ label, value, unit, digits }: InspectorRowProps): ReactElement {
  const figure = typeof value === "number";
  const numberProps = { ...(unit === undefined ? {} : { unit }), ...(digits === undefined ? {} : { digits }) };
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right">
        {figure ? (
          <NumberCell value={value} {...numberProps} />
        ) : (
          <>
            {value}
            {unit === undefined ? null : <span className="ml-1 text-ink-muted">{unit}</span>}
          </>
        )}
      </dd>
    </div>
  );
}
