#!/usr/bin/env node
// Arranca Next (`dev` o `start`) escuchando solo en 127.0.0.1 y en el puerto XPAND_WEB_PORT (8870 por defecto).
// Escuchar en otra dirección (HOST=0.0.0.0, una IP de la red) exige XPAND_PERMITIR_RED=1; sin ella, el arranque
// aborta con código 64 (EX_USAGE) y lo explica. `start` (servidor de producción) exige además AUTH_URL
// (ver src/libs/auth/host-confianza.ts). La decisión está en `decidirArranque`, probada en arranque.test.mjs.
//
// Antes de decidir carga apps/web/.env y apps/web/.env.local (los mismos que lee Next), sin pisar lo que ya
// venga del shell: así `pnpm start` ve el AUTH_URL o el XPAND_WEB_PORT escritos en .env.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const FICHEROS_ENV = [".env", ".env.local"];

export const CODIGO_USO = 64;
export const HOST_POR_DEFECTO = "127.0.0.1";
export const PUERTO_POR_DEFECTO = 8870;

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1"]);
const MODOS = new Set(["dev", "start"]);
const PUERTO_MAXIMO = 65535;

/**
 * Decide host, puerto y argumentos de Next a partir del modo y el entorno.
 * @param {{ modo: string | undefined, env: Record<string, string | undefined> }} entrada
 * @returns {{ ok: true, host: string, puerto: number, args: string[] } | { ok: false, codigo: number, mensaje: string }}
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
    return rechazo(`XPAND_WEB_PORT=${puertoTexto} no es un puerto válido (1-${PUERTO_MAXIMO}).`);
  }

  if (modo === "start" && !env.AUTH_URL?.trim()) {
    return rechazo(
      "AUTH_URL es obligatorio para el servidor de producción (la URL pública de la app): sin él los enlaces " +
        "de entrada se montarían sobre la cabecera Host de la petición.",
    );
  }

  return { ok: true, host, puerto, args: [modo, "-H", host, "-p", String(puerto)] };
};

const rechazo = (mensaje) => ({ ok: false, codigo: CODIGO_USO, mensaje });

/** Loads the app's env files into process.env; variables already set in the environment are kept. */
const cargarEnv = () => {
  for (const nombre of FICHEROS_ENV) {
    const ruta = fileURLToPath(new URL(`../${nombre}`, import.meta.url));
    if (existsSync(ruta)) {
      process.loadEnvFile(ruta);
    }
  }
};

const ejecutar = () => {
  cargarEnv();
  const decision = decidirArranque({ modo: process.argv[2], env: process.env });
  if (!decision.ok) {
    console.error(`arranque: ${decision.mensaje}`);
    process.exit(decision.codigo);
  }

  const next = fileURLToPath(new URL("../node_modules/.bin/next", import.meta.url));
  const hijo = spawn(next, decision.args, { stdio: "inherit" });
  hijo.on("error", (error) => {
    console.error(`arranque: no se pudo ejecutar next (${error.message})`);
    process.exit(1);
  });
  hijo.on("exit", (codigo, senal) => {
    if (senal) {
      process.kill(process.pid, senal);
      return;
    }
    process.exit(codigo ?? 1);
  });
  for (const senal of ["SIGINT", "SIGTERM"]) {
    process.on(senal, () => hijo.kill(senal));
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ejecutar();
}
