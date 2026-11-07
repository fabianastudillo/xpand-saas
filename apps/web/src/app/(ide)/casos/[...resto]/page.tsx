import { redirect } from "next/navigation";

import { StrayCasePage } from "@/ide/features/explorar/StrayCasePage";

interface Props {
  params: Promise<{ resto: string[] }>;
}

// /casos/<uno solo>: no es un caso; se lee como uno que no existe («caso no encontrado» con enlace al catálogo, §6.3).
// /casos/<más de dos>: no hay tal pantalla; el catálogo es la vuelta (como la ruta «*» de la SPA).
export default async function Page({ params }: Props) {
  const { resto } = await params;
  if (resto.length !== 1) redirect("/casos");
  return <StrayCasePage />;
}
