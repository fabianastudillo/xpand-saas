import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

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
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

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

export function Button({
  variant = "secondary",
  size = "md",
  asChild = false,
  className,
  type,
  ...props
}: ButtonProps): ReactElement {
  const Component = asChild ? Slot : "button";
  // A <button> defaults to type="submit" in forms; here it is a plain button unless told otherwise.
  const typeProps = asChild ? {} : { type: type ?? "button" };
  return (
    <Component
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...typeProps}
      {...props}
    />
  );
}
