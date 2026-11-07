import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn";

export interface SkeletonProps extends ComponentProps<"span"> {
  width?: string;
  height?: string;
}

/**
 * Loading placeholder: a line-colored block with a slow pulse. Hidden from assistive technology; the
 * container that is loading should carry aria-busy and a visible «Cargando…» text (t("common.loading")).
 */
export function Skeleton({ width, height, className, style, ...props }: SkeletonProps): ReactElement {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("block animate-pulse rounded-sm bg-line", className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
