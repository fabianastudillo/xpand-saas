import type { Metadata } from "next";

import { Typography } from "@/components/ui/typography";
import { Link } from "@/components/ui/link";
import { Footer } from "../_components/footer";

export const metadata: Metadata = { title: "Términos · XPAND" };

// Provisional draft (ruling R20): what the service is today, in a few lines. No clauses about purchases,
// subscriptions or data the platform does not handle. To be replaced by reviewed terms.
export default function TermsPage() {
  return (
    <div lang="es" className="pt-16 max-w-2xl">
      <Typography component="h1">Términos</Typography>
      <Typography className="mt-2 font-semibold">Borrador provisional</Typography>
      <Typography className="mt-2">
        Estos términos describen el servicio tal como es en esta versión. Se
        sustituirán por unos términos revisados.
      </Typography>

      <ul className="list-disc pl-6 mt-8 space-y-2">
        <li>
          XPAND es un planificador de expansión de sistemas eléctricos. En esta
          versión permite explorar casos de estudio públicos, sin cuenta.
        </li>
        <li>
          Para entrar se usa tu correo; qué se guarda está en{" "}
          <Link href="/privacy" className="underline">
            Privacidad
          </Link>
          .
        </li>
        <li>No hay pagos activos ni nada que comprar.</li>
      </ul>

      <Footer />
    </div>
  );
}
