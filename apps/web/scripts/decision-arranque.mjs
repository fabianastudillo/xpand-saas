// Decisión de arranque (host, puerto, argumentos y entorno de Next), sin dependencias: la comparten
// arranque.mjs (pnpm dev/start) y iniciar-release.mjs (el server.js del tarball de release). Probada en
// arranque.test.mjs.

export const CODIGO_USO = 64;
export const HOST_POR_DEFECTO = "127.0.0.1";
export const PUERTO_POR_DEFECTO = 8870;
export const NODE_ENV_POR_MODO = { dev: "development", start: "production" };

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1"]);
export const MODOS = new Set(Object.keys(NODE_ENV_POR_MODO));
const PUERTO_MAXIMO = 65535;

/**
 * Decide host, puerto y argumentos de Next a partir del modo y el entorno.
 * @param {{ modo: string | undefined, env: Record<string, string | undefined> }} entrada
 * @returns {{ ok: true, host: string, puerto: number, args: string[], entorno: { XPAND_WEB_HOST: string, XPAND_MODO_LOCAL: string } } | { ok: false, codigo: number, mensaje: string }}
 */
export const decidirArranque = ({ modo, env }) => {
  if (modo === undefined || !MODOS.has(modo)) {
    return rechazo(`Uso: arranque.mjs dev|start (recibido: ${modo ?? "nada"})`);
  }

  const host = env.HOST?.trim() || HOST_POR_DEFECTO;
  if (!HOSTS_LOCALES.has(host) && env.XPAND_PERMITIR_RED !== "1") {
    return rechazo(
      `HOST=${host} escucharía fuera de esta máquina. Si es lo que quieres, arranca con XPAND_PERMITIR_RED=1; ` +
        `si no, quita HOST (por defecto ${HOST_POR_DEFECTO}).`,
    );
  }

  const puertoTexto = env.XPAND_WEB_PORT?.trim() || String(PUERTO_POR_DEFECTO);
  const puerto = Number(puertoTexto);
  if (!/^\d+$/.test(puertoTexto) || puerto < 1 || puerto > PUERTO_MAXIMO) {
    return rechazo(
      `XPAND_WEB_PORT=${puertoTexto} no es un puerto válido (1-${PUERTO_MAXIMO}).`,
    );
  }

  if (modo === "start" && !env.AUTH_URL?.trim()) {
    return rechazo(
      "AUTH_URL es obligatorio para el servidor de producción (la URL pública de la app): sin él los enlaces " +
        "de entrada se montarían sobre la cabecera Host de la petición.",
    );
  }

  return {
    ok: true,
    host,
    puerto,
    args: [modo, "-H", host, "-p", String(puerto)],
    entorno: entornoDeNext({ host, env }),
  };
};

const rechazo = (mensaje) => ({ ok: false, codigo: CODIGO_USO, mensaje });

/**
 * Variables que el proceso de Next recibe además del entorno: XPAND_WEB_HOST (la dirección de `-H`) y
 * XPAND_MODO_LOCAL, la etiqueta «local» de /api/sesion (src/server/local.ts; nunca autoriza nada). Escuchando en
 * loopback vale 1 salvo que venga ya definida (XPAND_MODO_LOCAL=0 detrás de un proxy inverso en esta máquina);
 * escuchando en la red, 0.
 */
const entornoDeNext = ({ host, env }) => ({
  XPAND_WEB_HOST: host,
  XPAND_MODO_LOCAL: HOSTS_LOCALES.has(host) ? (env.XPAND_MODO_LOCAL?.trim() || "1") : "0",
});
