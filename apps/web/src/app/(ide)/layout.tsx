import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/ide/ide.css";
import { IdeZone } from "@/ide/IdeZone";

// The zone is its own root layout: its own <html>, its own stylesheet (the design system of @xpand/ui), and no
// session, database or third-party code of the template. A visit to /casos needs none of them.
// No `title` here: the title is the page's (the catalog, or the case's name) and the zone sets it in the browser;
// a title of the metadata would be put back by Next after the zone's, in production.
export const metadata: Metadata = {
  description: "Explorar casos de estudio de sistemas eléctricos.",
};

export default function IdeRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <IdeZone>{children}</IdeZone>
      </body>
    </html>
  );
}
