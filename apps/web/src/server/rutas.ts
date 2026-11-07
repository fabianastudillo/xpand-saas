// Logica de las rutas /api de solo lectura (catalogo, red, config, sesion). Los route handlers de src/app/api solo
// la llaman, asi que se prueba invocandola con objetos Request.
import { LectorError } from "@xpand/casos";
import { getSession } from "@/libs/auth/auth-utils";
import paquete from "../../package.json";
import { catalogoVigente, redVigente } from "./casos";
import { decidirLocal } from "./local";
import { error, json } from "./respuestas";

const TEC_SOPORTADA = "ac";

export async function responderCatalogo(): Promise<Response> {
  return json(await catalogoVigente());
}

export async function responderRed(request: Request): Promise<Response> {
  const consulta = new URL(request.url).searchParams;
  // `tec` es una lista separada por comas (packages/api); en M0 solo se construye la red con «ac». Se comprueba
  // antes de mirar el caso, para que la respuesta no dependa de si existe.
  const tecs = [...new Set((consulta.get("tec") ?? "").split(",").filter((t) => t !== ""))];
  if (tecs.length !== 1 || tecs[0] !== TEC_SOPORTADA) {
    return error(400, "tec_no_soportada", "Esta versión solo construye la red con tec=ac.");
  }
  const motor = consulta.get("motor") ?? "";
  const sistema = consulta.get("sistema") ?? "";
  try {
    const red = await redVigente(motor, sistema, TEC_SOPORTADA);
    // Inexistente, interno o id no valido: la misma respuesta, sin oraculo de existencia.
    if (!red) return error(404, "caso_no_encontrado", "No existe el caso pedido.");
    return json(red);
  } catch (e) {
    if (e instanceof LectorError) {
      console.error(`[api/red] ${motor}/${sistema}: ${e.message}`, e.cause ?? "");
      // El mensaje del LectorError solo nombra ficheros relativos del caso: apto para «Problemas».
      return error(500, e.codigo, `No se pudo leer la red del caso: ${e.message}.`);
    }
    console.error(`[api/red] ${motor}/${sistema}: error inesperado`, e);
    return error(500, "error_interno", "No se pudo construir la red del caso.");
  }
}

export function responderConfig(): Response {
  return json({ version: paquete.version });
}

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
