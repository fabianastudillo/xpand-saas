#!/usr/bin/env node
// server.js del tarball de release (se copia con ese nombre a la raíz): arranca el server.js autónomo de Next
// (apps/web/server.js) aplicando las mismas reglas que `pnpm start` (decision-arranque.mjs): escucha en 127.0.0.1 y
// XPAND_WEB_PORT (8870), otra dirección exige XPAND_PERMITIR_RED=1 y AUTH_URL es obligatoria (si no, código 64).
// Pasa a Next XPAND_WEB_HOST y XPAND_MODO_LOCAL: sin ellos nadie sería «local».
//
// Lee, si existen en esta carpeta, `.env.local` y `.env` (no vienen en el tarball; los crea quien instala). Lo que
// ya esté en el entorno del shell manda. NODE_ENV es siempre production.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { fileURLToPath } from "node:url";

import { decidirArranque } from "./decision-arranque.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));

// process.loadEnvFile no pisa variables ya definidas: .env.local se carga antes para que gane a .env.
for (const nombre of [".env.local", ".env"]) {
  const ruta = fileURLToPath(new URL(nombre, import.meta.url));
  if (existsSync(ruta)) {
    process.loadEnvFile(ruta);
  }
}
process.env.NODE_ENV = "production";

const decision = decidirArranque({ modo: "start", env: process.env });
if (!decision.ok) {
  console.error(`arranque: ${decision.mensaje}`);
  process.exit(decision.codigo);
}

// El server.js de Next lee HOSTNAME y PORT; HOSTNAME suele venir del sistema (el nombre de la máquina), por eso
// se fija siempre aquí.
const hijo = spawn(process.execPath, [fileURLToPath(new URL("apps/web/server.js", import.meta.url))], {
  stdio: "inherit",
  cwd: dir,
  env: {
    ...process.env,
    ...decision.entorno,
    HOSTNAME: decision.host,
    PORT: String(decision.puerto),
  },
});
hijo.on("error", (error) => {
  console.error(`arranque: no se pudo ejecutar apps/web/server.js (${error.message})`);
  process.exit(1);
});
hijo.on("exit", (codigo, senal) => {
  process.exit(senal ? 128 + (osConstants.signals[senal] ?? 0) : (codigo ?? 1));
});
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => hijo.kill(senal));
}
