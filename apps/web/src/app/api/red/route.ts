import { responderRed } from "@/server/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return responderRed(request);
}
