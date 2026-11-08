import { responderConfig } from "@/server/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return responderConfig();
}
