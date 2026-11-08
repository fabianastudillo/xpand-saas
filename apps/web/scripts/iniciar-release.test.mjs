import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Reproduce la disposición del tarball: server.js (este script), decision-arranque.mjs y apps/web/server.js, que aquí
// solo imprime lo que recibe.
const aqui = fileURLToPath(new URL(".", import.meta.url));
let raiz;

beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), "iniciar-release-"));
  copyFileSync(join(aqui, "iniciar-release.mjs"), join(raiz, "server.js"));
  copyFileSync(join(aqui, "decision-arranque.mjs"), join(raiz, "decision-arranque.mjs"));
  writeFileSync(join(raiz, "package.json"), '{"type":"module"}');
  mkdirSync(join(raiz, "apps/web"), { recursive: true });
  writeFileSync(
    join(raiz, "apps/web/server.js"),
    `const k = ["HOSTNAME","PORT","XPAND_WEB_HOST","XPAND_MODO_LOCAL","NODE_ENV","DESDE_ENV"];
console.log(JSON.stringify(Object.fromEntries(k.map((n) => [n, process.env[n] ?? null]))));`,
  );
});

afterAll(() => rmSync(raiz, { recursive: true, force: true }));

const correr = (env) =>
  spawnSync(process.execPath, [join(raiz, "server.js")], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });

describe("server.js del release", () => {
  it("sin AUTH_URL sale con 64 y no arranca Next", () => {
    const r = correr({});
    expect(r.status).toBe(64);
    expect(r.stderr).toContain("AUTH_URL");
    expect(r.stdout).toBe("");
  });

  it("escuchando fuera de loopback sin XPAND_PERMITIR_RED=1 sale con 64", () => {
    const r = correr({ AUTH_URL: "https://x.example", HOST: "0.0.0.0" });
    expect(r.status).toBe(64);
    expect(r.stdout).toBe("");
  });

  it("por defecto da a Next 127.0.0.1:8870, XPAND_WEB_HOST y XPAND_MODO_LOCAL=0 (opt-in, R19), y fija NODE_ENV=production", () => {
    const r = correr({ AUTH_URL: "http://localhost:8870", HOSTNAME: "mi-maquina", NODE_ENV: "development" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      HOSTNAME: "127.0.0.1",
      PORT: "8870",
      XPAND_WEB_HOST: "127.0.0.1",
      XPAND_MODO_LOCAL: "0",
      NODE_ENV: "production",
    });
  });

  it("XPAND_MODO_LOCAL=1 explícito se respeta en loopback", () => {
    const r = correr({ AUTH_URL: "http://localhost:8870", XPAND_MODO_LOCAL: "1" });
    expect(JSON.parse(r.stdout)).toMatchObject({ XPAND_MODO_LOCAL: "1" });
  });

  it("en la red XPAND_MODO_LOCAL=1 se ignora y vale 0", () => {
    const r = correr({
      AUTH_URL: "https://x.example",
      HOST: "0.0.0.0",
      XPAND_PERMITIR_RED: "1",
      XPAND_MODO_LOCAL: "1",
    });
    expect(JSON.parse(r.stdout)).toMatchObject({ XPAND_MODO_LOCAL: "0" });
  });

  it("en la red con permiso, XPAND_MODO_LOCAL=0 y el puerto de XPAND_WEB_PORT", () => {
    const r = correr({
      AUTH_URL: "https://x.example",
      HOST: "0.0.0.0",
      XPAND_PERMITIR_RED: "1",
      XPAND_WEB_PORT: "9000",
    });
    expect(JSON.parse(r.stdout)).toMatchObject({ HOSTNAME: "0.0.0.0", PORT: "9000", XPAND_MODO_LOCAL: "0" });
  });

  it("lee .env y .env.local de su carpeta; el shell manda sobre ellos y .env.local sobre .env", () => {
    writeFileSync(join(raiz, ".env"), "AUTH_URL=http://localhost:8870\nDESDE_ENV=env\nXPAND_WEB_PORT=8999\n");
    writeFileSync(join(raiz, ".env.local"), "DESDE_ENV=local\n");
    try {
      const r = correr({ XPAND_WEB_PORT: "8123" });
      expect(JSON.parse(r.stdout)).toMatchObject({ DESDE_ENV: "local", PORT: "8123" });
    } finally {
      rmSync(join(raiz, ".env"));
      rmSync(join(raiz, ".env.local"));
    }
  });
});
