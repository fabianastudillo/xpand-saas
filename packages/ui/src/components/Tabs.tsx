import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn";

/**
 * Radix Tabs with the «técnico claro» look: a thin rule under the list and a 2px accent underline on the
 * active tab, instead of shadcn's filled pill. Keyboard: arrows, Home and End move; focus follows.
 */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>): ReactElement {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>): ReactElement {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex items-end border-b border-line", className)}
      {...props}
    />
  );
}

const TRIGGER =
  "relative -mb-px inline-flex h-(--row-h) items-center border-b-2 border-transparent px-3 text-sm " +
  "font-medium whitespace-nowrap text-ink-muted transition-colors select-none " +
  "hover:text-ink " +
  "data-[state=active]:border-accent data-[state=active]:text-ink " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50";

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): ReactElement {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(TRIGGER, className)} {...props} />;
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>): ReactElement {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}
      {...props}
    />
  );
}
