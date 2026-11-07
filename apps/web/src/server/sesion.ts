// Logica de GET /api/sesion, aparte de rutas.ts para que las rutas publicas de casos no carguen next-auth ni Prisma.
import { getSession } from "@/libs/auth/auth-utils";
import { decidirLocal } from "./local";
import { json } from "./respuestas";

export async function responderSesion(): Promise<Response> {
  let sesion: Awaited<ReturnType<typeof getSession>> = null;
  try {
    sesion = await getSession();
  } catch (e) {
    // Sin Postgres la sesion no se puede leer: la zona IDE publica sigue funcionando, como sin sesion.
    console.error("[api/sesion] no se pudo leer la sesion; se responde como sin sesion:", e instanceof Error ? e.message : e);
  }
  const usuario = sesion?.user;
  return json({
    dentro: Boolean(usuario),
    local: decidirLocal(process.env),
    nombre: usuario?.name || usuario?.email || "",
    exigida: false,
  });
}
