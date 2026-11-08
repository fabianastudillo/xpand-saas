"use client";

import { t } from "@xpand/ui";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Client only, as the SPA was: the zone reads the window (media queries, localStorage, focus) from its first
// render, and a server render would only be thrown away at hydration. The page is a static shell that Next serves
// without session or database.
const IdeRoot = dynamic(() => import("./IdeRoot").then((module) => module.IdeRoot), {
  ssr: false,
  // The static shell and the chunk still loading: a visible, announced state instead of a blank page.
  loading: () => (
    <>
      <title>XPAND</title>
      <p role="status" className="p-4 text-sm">
        {t("common.loading")}
      </p>
    </>
  ),
});

/** The IDE zone: providers and frame around the page of the route. */
export function IdeZone({ children }: { children: ReactNode }) {
  return <IdeRoot>{children}</IdeRoot>;
}
