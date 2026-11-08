import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Shortcut } from "./Kbd";

const DEFAULT_DELAY_MS = 300;

/** Wrap the app once. Tooltips open after `delayDuration` ms (default 300) and share the timer. */
export function TooltipProvider({
  delayDuration = DEFAULT_DELAY_MS,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>): ReactElement {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export interface TooltipProps {
  content: ReactNode;
  /** Keyboard shortcut shown after the text, as keys: "Ctrl+K". Also set as aria-keyshortcuts. */
  shortcut?: string;
  side?: ComponentProps<typeof TooltipPrimitive.Content>["side"];
  /** Exactly one focusable element; the tooltip opens on hover and on keyboard focus. */
  children: ReactElement;
}

const CONTENT =
  "z-50 inline-flex max-w-xs items-center gap-2 rounded-md bg-ink px-2 py-1 text-xs text-ink-inverse shadow-pop";

/** Display names → ARIA key names (WAI-ARIA aria-keyshortcuts uses UI Events key values). */
const ARIA_KEY_NAMES: Readonly<Record<string, string>> = {
  ctrl: "Control",
  cmd: "Meta",
  "⌘": "Meta",
  option: "Alt",
  esc: "Escape",
  del: "Delete",
};

/** "Ctrl+K" → "Control+K", as aria-keyshortcuts expects. */
export function toAriaKeyshortcuts(shortcut: string): string {
  return shortcut
    .split("+")
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .map((key) => ARIA_KEY_NAMES[key.toLowerCase()] ?? key)
    .join("+");
}

/** Radix Tooltip with a single, dark, high-contrast style. Content is text; never the only place for it. */
export function Tooltip({ content, shortcut, side = "top", children }: TooltipProps): ReactElement {
  const keyshortcuts = shortcut === undefined ? {} : { "aria-keyshortcuts": toAriaKeyshortcuts(shortcut) };
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild {...keyshortcuts}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content data-slot="tooltip" side={side} sideOffset={4} className={CONTENT}>
          <span>{content}</span>
          {shortcut ? <Shortcut keys={shortcut} className="text-ink-inverse/80" /> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
