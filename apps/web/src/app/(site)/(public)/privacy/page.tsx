import type { Metadata } from "next";

import { Typography } from "@/components/ui/typography";
import { Footer } from "../_components/footer";

export const metadata: Metadata = { title: "Privacidad · XPAND" };

// Provisional draft (ruling R20): only what the platform does today. Nothing about data it does not collect. To be
// replaced by a reviewed text; whoever changes what the platform keeps changes this page in the same commit.
export default function PrivacyPage() {
  return (
    <div lang="es" className="pt-16 max-w-2xl">
      <Typography component="h1">Privacidad</Typography>
      <Typography className="mt-2 font-semibold">Borrador provisional</Typography>
      <Typography className="mt-2">
        Este texto describe lo que hace XPAND en esta versión. Se sustituirá
        por una política revisada.
      </Typography>

      <Typography component="h2" className="mt-8">
        Qué guarda XPAND
      </Typography>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Tu dirección de correo, si creas una cuenta: sirve para enviarte el
          enlace de entrada y para reconocerte.
        </li>
        <li>
          Tu sesión mientras estás dentro: una cookie cifrada en tu navegador.
        </li>
        <li>
          Si el servidor tiene activada la entrada con Google y la usas, el
          nombre y la imagen de perfil que Google comparte y el enlace con tu
          cuenta de Google.
        </li>
      </ul>

      <Typography component="h2" className="mt-8">
        Qué no hace
      </Typography>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          No hay analítica ni chat de soporte mientras el servidor no los tenga
          configurados.
        </li>
        <li>No hay pagos activos: sin sus claves no se habla con ningún proveedor de pagos.</li>
        <li>Explorar los casos públicos no pide cuenta.</li>
      </ul>

      <Footer />
    </div>
  );
}
