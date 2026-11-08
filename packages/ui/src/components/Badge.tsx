import type { ComponentProps, ReactElement, ReactNode } from "react";
import { t, useLocale, type MessageKey } from "../i18n";
import { cn } from "../lib/cn";

/** Status tones carry the result-honesty invariant; the free tones are for any other label. */
export type StatusTone = "certified" | "uncertified" | "ac-feasible";
export type FreeTone = "warn" | "error" | "neutral";
export type BadgeTone = StatusTone | FreeTone;

type BaseProps = Omit<ComponentProps<"span">, "children">;

/**
 * «NO CERTIFICADO» and «Factible en AC» cannot be reworded: those tones take no children.
 * `certified` has a default label that a more specific one («Certificado AC») may replace.
 */
export type BadgeProps = BaseProps &
  (
    | { tone: "uncertified" | "ac-feasible"; children?: never }
    | { tone: "certified" | FreeTone; children?: ReactNode }
  );

const BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-xs leading-5 font-medium";

const TONE: Readonly<Record<BadgeTone, string>> = {
  certified: "border-ok-line bg-ok-bg text-ok-ink",
  // Same colors as error, plus weight and uppercase: it must be the loudest badge on screen.
  uncertified: "border-error bg-error-bg text-error-ink font-semibold uppercase tracking-label",
  // At most feasible in AC, never certified: a caution, not a success.
  "ac-feasible": "border-warn-line bg-warn-bg text-warn-ink",
  warn: "border-warn-line bg-warn-bg text-warn-ink",
  error: "border-error-line bg-error-bg text-error-ink",
  neutral: "border-line bg-surface-sunken text-ink-muted",
};

const FIXED_LABEL: Readonly<Partial<Record<BadgeTone, MessageKey>>> = {
  uncertified: "status.uncertified",
  "ac-feasible": "status.acFeasible",
};

const DEFAULT_LABEL: Readonly<Partial<Record<BadgeTone, MessageKey>>> = {
  certified: "status.certified",
};

function labelFor(tone: BadgeTone, children: ReactNode): ReactNode {
  const fixed = FIXED_LABEL[tone];
  if (fixed) return t(fixed);
  if (children !== undefined && children !== null) return children;
  const fallback = DEFAULT_LABEL[tone];
  return fallback ? t(fallback) : null;
}

export function Badge({ tone, children, className, ...props }: BadgeProps): ReactElement {
  useLocale(); // re-render the translated labels when the locale changes
  return (
    <span data-slot="badge" data-tone={tone} className={cn(BASE, TONE[tone], className)} {...props}>
      {labelFor(tone, children)}
    </span>
  );
}
