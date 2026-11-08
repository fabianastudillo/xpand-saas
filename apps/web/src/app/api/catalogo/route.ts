import { responderCatalogo } from "@/server/rutas";

export const runtime = "nodejs";
// Lee el almacen en cada peticion (con su cache y TTL): nunca se prerenderiza en el build.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return responderCatalogo();
}
