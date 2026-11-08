import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends ComponentProps<"input"> {
  /** Figures: IBM Plex Mono, tabular digits, right-aligned. */
  mono?: boolean;
}

const BASE =
  "h-(--control-h) w-full rounded-md border border-line-strong bg-surface-raised px-2 text-base text-ink " +
  "placeholder:text-ink-muted " +
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent " +
  // The error border wins over the focus border: the stacked variant is more specific than either alone.
  "aria-invalid:border-error aria-invalid:focus-visible:border-error " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ mono = false, className, type = "text", ...props }: InputProps): ReactElement {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(BASE, mono && "font-mono tabular-nums text-right", className)}
      {...props}
    />
  );
}
