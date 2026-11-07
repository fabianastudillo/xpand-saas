// Logica de las rutas /api de casos y config. Los route handlers de src/app/api solo la llaman, asi que se prueba
// invocandola con objetos Request. /api/sesion vive en sesion.ts: asi estas rutas no cargan la pila de next-auth.
import { LectorError } from "@xpand/casos";
import paquete from "../../package.json";
import { AlmacenNoDisponible, catalogoVigente, redVigente } from "./casos";
import { error, json } from "./respuestas";

const TEC_SOPORTADA = "ac";

function almacenNoDisponible(): Response {
  return error(503, "almacen_no_disponible", "El almacén de casos no está disponible; se reintentará.");
}

export async function responderCatalogo(): Promise<Response> {
  try {
    return json(await catalogoVigente());
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return almacenNoDisponible();
    console.error("[api/catalogo] error inesperado", e);
    return error(500, "error_interno", "No se pudo leer el catálogo.");
  }
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
    if (e instanceof AlmacenNoDisponible) return almacenNoDisponible();
    if (e instanceof LectorError) {
      // Ya registrado (una vez por carga) en redVigente. El mensaje del LectorError solo nombra ficheros
      // relativos del caso: apto para «Problemas».
      return error(500, e.codigo, `No se pudo leer la red del caso: ${e.message}.`);
    }
    console.error(`[api/red] ${motor}/${sistema}: error inesperado`, e);
    return error(500, "error_interno", "No se pudo construir la red del caso.");
  }
}

export function responderConfig(): Response {
  return json({ version: paquete.version });
}
