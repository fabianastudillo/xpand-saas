// Respuestas JSON de las rutas /api de casos. Los errores tienen una sola forma, { error: { codigo, mensaje } },
// sin rutas del disco ni trazas (contrato de la plataforma).
const SIN_CACHE = { "Cache-Control": "no-store" } as const;

export function json(cuerpo: unknown, status = 200): Response {
  return Response.json(cuerpo, { status, headers: SIN_CACHE });
}

export function error(status: number, codigo: string, mensaje: string): Response {
  return json({ error: { codigo, mensaje } }, status);
}
