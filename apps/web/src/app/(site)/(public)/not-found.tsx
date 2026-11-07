import Link from "next/link";

import { Typography } from "@/components/ui/typography";

// A page of the public zone that answers 404 on purpose (today: /pricing while payments are off). It renders inside
// the site's own layout; the root app/not-found.tsx, with its own <html>, is for addresses no route matches.
export default function PublicNotFound() {
  return (
    <section lang="es" className="py-16">
      <Typography component="h1">Página no encontrada</Typography>
      <Typography className="mt-4">
        No hay ninguna página en esta dirección.
      </Typography>
      <Typography className="mt-4">
        <Link href="/" className="underline">
          Inicio
        </Link>{" "}
        ·{" "}
        <Link href="/casos" className="underline">
          Explorar casos
        </Link>
      </Typography>
    </section>
  );
}
