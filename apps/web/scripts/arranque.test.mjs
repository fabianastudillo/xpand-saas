import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CODIGO_USO,
  cargarEntorno,
  codigoDeSalida,
  decidirArranque,
} from "./arranque.mjs";

const base = { AUTH_URL: "http://127.0.0.1:8870" };

describe("decidirArranque", () => {
  it("without HOST or XPAND_WEB_PORT, dev listens on 127.0.0.1:8870", () => {
    expect(decidirArranque({ modo: "dev", env: {} })).toEqual({
      ok: true,
      host: "127.0.0.1",
      puerto: 8870,
      args: ["dev", "-H", "127.0.0.1", "-p", "8870"],
      entorno: { XPAND_WEB_HOST: "127.0.0.1", XPAND_MODO_LOCAL: "1" },
    });
  });

  it("passes Next the listening host and, on loopback, XPAND_MODO_LOCAL=1 (the «local» label of /api/sesion)", () => {
    for (const modo of ["dev", "start"]) {
      expect(decidirArranque({ modo, env: { ...base, HOST: "::1" } }).entorno).toEqual({
        XPAND_WEB_HOST: "::1",
        XPAND_MODO_LOCAL: "1",
      });
    }
  });

  it("keeps an explicit XPAND_MODO_LOCAL (=0 behind a reverse proxy on this machine)", () => {
    expect(decidirArranque({ modo: "start", env: { ...base, XPAND_MODO_LOCAL: "0" } }).entorno).toEqual({
      XPAND_WEB_HOST: "127.0.0.1",
      XPAND_MODO_LOCAL: "0",
    });
  });

  it("listening on the network, XPAND_MODO_LOCAL is 0", () => {
    expect(
      decidirArranque({ modo: "dev", env: { ...base, HOST: "0.0.0.0", XPAND_PERMITIR_RED: "1" } }).entorno,
    ).toEqual({ XPAND_WEB_HOST: "0.0.0.0", XPAND_MODO_LOCAL: "0" });
  });

  it("takes the port from XPAND_WEB_PORT", () => {
    const decision = decidirArranque({
      modo: "dev",
      env: { XPAND_WEB_PORT: "8871" },
    });
    expect(decision).toMatchObject({ ok: true, puerto: 8871 });
    expect(decision.args).toEqual(["dev", "-H", "127.0.0.1", "-p", "8871"]);
  });

  it("an empty XPAND_WEB_PORT means the default port", () => {
    expect(
      decidirArranque({ modo: "dev", env: { XPAND_WEB_PORT: "" } }),
    ).toMatchObject({ ok: true, puerto: 8870 });
  });

  it.each(["127.0.0.1", "localhost", "::1"])(
    "accepts the local host %s without permission",
    (host) => {
      expect(
        decidirArranque({ modo: "dev", env: { HOST: host } }),
      ).toMatchObject({ ok: true, host });
    },
  );

  it.each(["0.0.0.0", "192.168.1.10", "::"])(
    "refuses HOST=%s with code 64 unless XPAND_PERMITIR_RED=1",
    (host) => {
      const decision = decidirArranque({ modo: "dev", env: { HOST: host } });
      expect(decision).toMatchObject({ ok: false, codigo: CODIGO_USO });
      expect(decision.mensaje).toContain("XPAND_PERMITIR_RED=1");

      expect(
        decidirArranque({
          modo: "dev",
          env: { ...base, HOST: host, XPAND_PERMITIR_RED: "1" },
        }),
      ).toMatchObject({
        ok: true,
        host,
      });
    },
  );

  it("XPAND_PERMITIR_RED must be exactly 1", () => {
    expect(
      decidirArranque({
        modo: "dev",
        env: { HOST: "0.0.0.0", XPAND_PERMITIR_RED: "true" },
      }),
    ).toMatchObject({
      ok: false,
      codigo: CODIGO_USO,
    });
  });

  it.each(["abc", "0", "70000", "80.5"])(
    "refuses an invalid port (%s) with code 64",
    (puerto) => {
      const decision = decidirArranque({
        modo: "dev",
        env: { XPAND_WEB_PORT: puerto, ...base },
      });
      expect(decision).toMatchObject({ ok: false, codigo: CODIGO_USO });
      expect(decision.mensaje).toContain("XPAND_WEB_PORT");
    },
  );

  it("refuses an unknown mode with code 64", () => {
    expect(decidirArranque({ modo: "build", env: base })).toMatchObject({
      ok: false,
      codigo: CODIGO_USO,
    });
    expect(decidirArranque({ modo: undefined, env: base })).toMatchObject({
      ok: false,
      codigo: CODIGO_USO,
    });
  });

  it.each(["dev", "start"])(
    "%s on a host other than loopback requires AUTH_URL, also with XPAND_PERMITIR_RED=1",
    (modo) => {
      // Without it, Auth.js would trust the Host header (development) and build the sign-in links on it.
      const env = { HOST: "0.0.0.0", XPAND_PERMITIR_RED: "1" };
      const sinAuthUrl = decidirArranque({ modo, env });
      expect(sinAuthUrl).toMatchObject({ ok: false, codigo: CODIGO_USO });
      expect(sinAuthUrl.mensaje).toContain("AUTH_URL");

      expect(decidirArranque({ modo, env: { ...env, AUTH_URL: " " } })).toMatchObject({ ok: false });
      expect(decidirArranque({ modo, env: { ...env, ...base } })).toMatchObject({ ok: true, host: "0.0.0.0" });
    },
  );

  it("dev on loopback does not need AUTH_URL", () => {
    expect(decidirArranque({ modo: "dev", env: { HOST: "::1" } })).toMatchObject({ ok: true });
  });

  it("start (production server) requires AUTH_URL", () => {
    const sinAuthUrl = decidirArranque({ modo: "start", env: {} });
    expect(sinAuthUrl).toMatchObject({ ok: false, codigo: CODIGO_USO });
    expect(sinAuthUrl.mensaje).toContain("AUTH_URL");

    expect(decidirArranque({ modo: "start", env: base })).toMatchObject({
      ok: true,
      args: ["start", "-H", "127.0.0.1", "-p", "8870"],
    });
  });
});

describe("cargarEntorno", () => {
  let dir;

  const nodeEnvPrevio = process.env.NODE_ENV;

  // Set before the first load: variables already in the environment must survive every load (the shell wins).
  beforeAll(() => {
    process.env.XPAND_PRUEBA_SHELL = "shell";
  });

  // Leave the worker's environment as it was: @next/env rewrites process.env from its snapshot on every load.
  afterAll(() => {
    nextEnv.resetEnv();
    delete process.env.XPAND_PRUEBA_SHELL;
    delete process.env.__NEXT_PROCESSED_ENV;
    process.env.NODE_ENV = nodeEnvPrevio;
  });

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    delete process.env.XPAND_PRUEBA;
  });

  const conFicheros = (ficheros) => {
    dir = mkdtempSync(join(tmpdir(), "arranque-env-"));
    for (const [nombre, contenido] of Object.entries(ficheros))
      writeFileSync(join(dir, nombre), contenido);
    return dir;
  };

  it(".env.local wins over .env, as in Next", () => {
    cargarEntorno({
      dir: conFicheros({
        ".env": "XPAND_PRUEBA=base\n",
        ".env.local": "XPAND_PRUEBA=local\n",
      }),
      modo: "dev",
    });
    expect(process.env.XPAND_PRUEBA).toBe("local");
  });

  it(".env.development.local wins over .env.local for dev", () => {
    cargarEntorno({
      dir: conFicheros({
        ".env.local": "XPAND_PRUEBA=local\n",
        ".env.development.local": "XPAND_PRUEBA=dev-local\n",
      }),
      modo: "dev",
    });
    expect(process.env.XPAND_PRUEBA).toBe("dev-local");
  });

  it(".env.production wins over .env for start, and is ignored for dev", () => {
    const ficheros = {
      ".env": "XPAND_PRUEBA=base\n",
      ".env.production": "XPAND_PRUEBA=produccion\n",
    };
    cargarEntorno({ dir: conFicheros(ficheros), modo: "start" });
    expect(process.env.XPAND_PRUEBA).toBe("produccion");

    cargarEntorno({ dir, modo: "dev" });
    expect(process.env.XPAND_PRUEBA).toBe("base");
  });

  it("the shell wins over every file", () => {
    cargarEntorno({
      dir: conFicheros({ ".env.local": "XPAND_PRUEBA_SHELL=fichero\n" }),
      modo: "dev",
    });
    expect(process.env.XPAND_PRUEBA_SHELL).toBe("shell");
  });

  it("owns NODE_ENV: production for start and development for dev, whatever the files say", () => {
    cargarEntorno({
      dir: conFicheros({ ".env": "NODE_ENV=development\n" }),
      modo: "start",
    });
    expect(process.env.NODE_ENV).toBe("production");

    cargarEntorno({ dir, modo: "dev" });
    expect(process.env.NODE_ENV).toBe("development");
  });

  it("works without any env file", () => {
    expect(() =>
      cargarEntorno({ dir: conFicheros({}), modo: "dev" }),
    ).not.toThrow();
  });
});

describe("codigoDeSalida", () => {
  it("passes the child's exit code through", () => {
    expect(codigoDeSalida(0, null)).toBe(0);
    expect(codigoDeSalida(3, null)).toBe(3);
  });

  it("a child killed by a signal is a failure: 128 + the signal number", () => {
    expect(codigoDeSalida(null, "SIGTERM")).toBe(128 + 15);
    expect(codigoDeSalida(null, "SIGINT")).toBe(128 + 2);
    expect(codigoDeSalida(null, "SIGSEGV")).toBe(128 + 11);
  });

  it("no code and no signal is still a failure", () => {
    expect(codigoDeSalida(null, null)).toBe(1);
  });
});

// The wrapper as it really runs (plain Node, not vitest's module interop): imports resolve and the refusals
// exit with code 64 before Next is ever spawned.
describe("arranque.mjs under node", () => {
  const script = fileURLToPath(new URL("./arranque.mjs", import.meta.url));
  const correr = (args, env) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: mkdtempSync(join(tmpdir(), "arranque-cwd-")),
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
    });

  it("an unknown mode exits with 64", () => {
    const resultado = correr(["build"], {});
    expect(resultado.stderr).toContain("Uso: arranque.mjs dev|start");
    expect(resultado.status).toBe(CODIGO_USO);
  });

  it("a non-local HOST without XPAND_PERMITIR_RED=1 exits with 64", () => {
    const resultado = correr(["dev"], { HOST: "0.0.0.0" });
    expect(resultado.stderr).toContain("XPAND_PERMITIR_RED=1");
    expect(resultado.status).toBe(CODIGO_USO);
  });
});
