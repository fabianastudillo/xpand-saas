// `local` de GET /api/sesion: la interfaz solo lo usa para rotular «Sesión local».
//
// INVARIANTE (R14): ninguna autorización puede depender de `local`. En xpand «local» abría la sesión de
// administrador; en la plataforma es solo una etiqueta y debe seguir siéndolo. Lo que necesite permisos se decide con
// la sesión de next-auth y su rol, nunca con esto.
//
// Es opt-in explícito y falla cerrado: true solo con XPAND_MODO_LOCAL=1 Y Next escuchando solo en loopback
// (XPAND_WEB_HOST). scripts/arranque.mjs pone las dos para `pnpm dev`/`pnpm start` en 127.0.0.1. Por defecto
// (server.js standalone, Next arrancado a mano, escucha en la red) es false. Ninguna cabecera de la petición
// cuenta: Next rellena X-Forwarded-For con `??=`, así que la manda el cliente. Detrás de un proxy inverso en esta
// misma máquina todo llega por 127.0.0.1: ahí XPAND_MODO_LOCAL debe ser 0 (o no estar, si no se usa arranque.mjs).

// Los mismos hosts locales que acepta scripts/arranque.mjs sin XPAND_PERMITIR_RED.
const HOSTS_LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

export function decidirLocal(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.XPAND_MODO_LOCAL !== "1") return false;
  const host = env.XPAND_WEB_HOST?.trim();
  return host !== undefined && HOSTS_LOOPBACK.has(host);
}
