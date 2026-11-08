import { Slot } from "@radix-ui/react-slot";
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/**
 * Two ways to disable:
 * - `disabled`: the native attribute; the button leaves the tab order and cannot show a tooltip.
 * - `aria-disabled`: «disabled with a reason». The button stays focusable (so a <Tooltip> can say why) and
 *   looks disabled, but clicks, Enter and Space are swallowed, also when `asChild` wraps a link.
 * Icon-only buttons must carry their own `aria-label`: the icon is not a name.
 */
export interface ButtonProps extends ComponentProps<"button"> {
  /** `primary` is the one accent action per view («Resolver»); everything else is secondary or ghost. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders the child element (e.g. a link) with the button styles instead of a <button>. */
  asChild?: boolean;
}

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium " +
  "select-none transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-accent bg-accent text-accent-ink hover:bg-accent-hover hover:border-accent-hover",
  secondary: "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
  ghost: "border-transparent bg-transparent text-ink hover:bg-surface-sunken",
  danger: "border-error bg-surface-raised text-error-ink hover:bg-error-bg",
};

const SIZE: Readonly<Record<ButtonSize, string>> = {
  sm: "h-(--control-h-sm) px-2 text-xs",
  md: "h-(--control-h) px-3 text-sm",
};

const ACTIVATION_KEYS = new Set(["Enter", " "]);

function isAriaDisabled(value: ButtonProps["aria-disabled"]): boolean {
  return value === true || value === "true";
}

/**
 * Slot merges handlers child-first, so a soft-disabled `asChild` link would still run its own onClick before
 * ours could stop it. Strip the child's activation handlers; ours then swallow the event.
 */
function silenceChildHandlers(children: ReactNode): ReactNode {
  if (!isValidElement<{ onClick?: unknown; onKeyDown?: unknown }>(children)) return children;
  return cloneElement(children, { onClick: undefined, onKeyDown: undefined });
}

export function Button({
  variant = "secondary",
  size = "md",
  asChild = false,
  className,
  type,
  onClick,
  onKeyDown,
  "aria-disabled": ariaDisabled,
  children,
  ...props
}: ButtonProps): ReactElement {
  const Component = asChild ? Slot : "button";
  const softDisabled = isAriaDisabled(ariaDisabled);
  // A <button> defaults to type="submit" in forms; here it is a plain button unless told otherwise.
  const typeProps = asChild ? {} : { type: type ?? "button" };
  const content = asChild && softDisabled ? silenceChildHandlers(children) : children;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (softDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (softDisabled && ACTIVATION_KEYS.has(event.key)) {
      event.preventDefault();
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <Component
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      aria-disabled={softDisabled ? true : ariaDisabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...typeProps}
      {...props}
    >
      {content}
    </Component>
  );
}
