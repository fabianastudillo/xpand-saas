import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/ide/ide.css";
import { IdeZone } from "@/ide/IdeZone";

// The zone is its own root layout: its own <html>, its own stylesheet (the design system of @xpand/ui), and no
// session, database or third-party code of the template. A visit to /casos needs none of them.
// No `title` in the metadata: Next puts it back after the zone's own in production. The zone renders a <title> itself
// (the shell's in its loading state, then the page's).
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
