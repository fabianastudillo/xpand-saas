import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn";

/** One key: IBM Plex Mono, thin border in the current color, so it works on light and dark surfaces. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">): ReactElement {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-[1.4em] items-center justify-center rounded-sm border border-current/40 px-1",
        "font-mono text-[0.85em] leading-4 font-medium text-inherit",
        className,
      )}
      {...props}
    />
  );
}

export interface ShortcutProps extends Omit<ComponentProps<"span">, "children"> {
  /** Combination with `+` between keys: "Ctrl+K", "Ctrl+Shift+P". */
  keys: string;
}

/** A key combination: one <kbd> per key for sighted users, the whole phrase for screen readers. */
export function Shortcut({ keys, className, ...props }: ShortcutProps): ReactElement {
  const parts = keys
    .split("+")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  return (
    <span data-slot="shortcut" className={cn("inline-flex items-center gap-0.5", className)} {...props}>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {parts.map((key, index) => (
          <Kbd key={`${String(index)}-${key}`}>{key}</Kbd>
        ))}
      </span>
      <span className="xp-sr-only">{keys}</span>
    </span>
  );
}
