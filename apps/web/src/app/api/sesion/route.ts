import { responderSesion } from "@/server/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return responderSesion();
}
