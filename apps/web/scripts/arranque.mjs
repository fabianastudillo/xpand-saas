#!/usr/bin/env node
// Arranca Next (`dev` o `start`) escuchando solo en 127.0.0.1 y en el puerto XPAND_WEB_PORT (8870 por defecto).
// Escuchar en otra dirección (HOST=0.0.0.0, una IP de la red) exige XPAND_PERMITIR_RED=1; sin ella, el arranque
// aborta con código 64 (EX_USAGE) y lo explica. `start` (servidor de producción) exige además AUTH_URL
// (ver src/libs/auth/host-confianza.ts). La decisión está en `decidirArranque`, probada en arranque.test.mjs.
//
// Antes de decidir carga los ficheros .env de apps/web con @next/env, es decir, los mismos y en el mismo orden
// que Next (.env.<modo>.local, .env.local, .env.<modo>, .env; el más específico gana) y sin pisar lo que ya
// venga del shell. NODE_ENV lo fija este script (production para `start`, development para `dev`): ningún
// fichero ni el shell lo cambian, para que `pnpm start` nunca corra con React en modo desarrollo.

import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
// @next/env is a CommonJS bundle whose named exports Node cannot detect: default import, then destructure.
import nextEnv from "@next/env";

const { loadEnvConfig, updateInitialEnv } = nextEnv;

export const CODIGO_USO = 64;
export const HOST_POR_DEFECTO = "127.0.0.1";
export const PUERTO_POR_DEFECTO = 8870;
export const NODE_ENV_POR_MODO = { dev: "development", start: "production" };

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1"]);
const MODOS = new Set(Object.keys(NODE_ENV_POR_MODO));
const PUERTO_MAXIMO = 65535;
const SILENCIO = { info() {}, error: console.error };

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
  };
};

const rechazo = (mensaje) => ({ ok: false, codigo: CODIGO_USO, mensaje });

/**
 * Loads the env files of `dir` for `modo` into process.env with Next's own loader and precedence. Variables
 * already in the environment are kept. NODE_ENV is owned by the wrapper: it is set to the mode's value both
 * before loading (so no file can define it) and after (so nothing else can either).
 */
export const cargarEntorno = ({ dir, modo }) => {
  const nodeEnv = NODE_ENV_POR_MODO[modo];
  process.env.NODE_ENV = nodeEnv;
  // @next/env restores its snapshot of the initial environment on every load; keep NODE_ENV in it.
  updateInitialEnv({ NODE_ENV: nodeEnv });
  const { loadedEnvFiles } = loadEnvConfig(dir, modo === "dev", SILENCIO, true);
  process.env.NODE_ENV = nodeEnv;
  return loadedEnvFiles.map((fichero) => fichero.path);
};

/** Exit code for the wrapper from the child's exit: a death by signal is a failure (128 + signal number). */
export const codigoDeSalida = (codigo, senal) => {
  if (senal) {
    return 128 + (osConstants.signals[senal] ?? 0);
  }
  return codigo ?? 1;
};

const ejecutar = () => {
  const modo = process.argv[2];
  const dirApp = fileURLToPath(new URL("..", import.meta.url));

  if (MODOS.has(modo)) {
    cargarEntorno({ dir: dirApp, modo });
  }

  const decision = decidirArranque({ modo, env: process.env });
  if (!decision.ok) {
    console.error(`arranque: ${decision.mensaje}`);
    process.exit(decision.codigo);
  }

  const nextBin = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
  const hijo = spawn(process.execPath, [nextBin, ...decision.args], {
    stdio: "inherit",
  });
  hijo.on("error", (error) => {
    console.error(`arranque: no se pudo ejecutar next (${error.message})`);
    process.exit(1);
  });
  hijo.on("exit", (codigo, senal) => {
    if (senal) {
      console.error(`arranque: next terminó por la señal ${senal}`);
    }
    process.exit(codigoDeSalida(codigo, senal));
  });
  for (const senal of ["SIGINT", "SIGTERM"]) {
    process.on(senal, () => hijo.kill(senal));
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  ejecutar();
}
