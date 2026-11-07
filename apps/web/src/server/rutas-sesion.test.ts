import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/libs/auth/auth-utils", () => ({ getSession: vi.fn() }));

import { createSchemaValidator } from "@xpand/api/validate";
import { getSession } from "@/libs/auth/auth-utils";
import { GET as getConfig } from "@/app/api/config/route";
import { GET as getSesion } from "@/app/api/sesion/route";
import { decidirLocal } from "@/server/local";
import paquete from "../../package.json";

const validador = createSchemaValidator();

// El handler de /api/sesion no recibe la peticion: `local` no puede depender de nada que mande el cliente.
const pedirSesion = () => getSesion();

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/config", () => {
  it("valida y da la version de apps/web/package.json", async () => {
    const r = getConfig();
    expect(r.status).toBe(200);
    const c = (await r.json()) as { version: string };
    expect(validador.check("config", c)).toBeUndefined();
    expect(c).toStrictEqual({ version: paquete.version });
  });
});

describe("GET /api/sesion", () => {
  it("sin sesion: dentro false, nombre vacio, exigida false; valida", async () => {
    vi.stubEnv("XPAND_WEB_HOST", "127.0.0.1");
    vi.stubEnv("XPAND_MODO_LOCAL", "1");
    const s = (await (await pedirSesion()).json()) as unknown;
    expect(validador.check("sesion", s)).toBeUndefined();
    expect(s).toStrictEqual({ dentro: false, local: true, nombre: "", exigida: false });
  });

  it("con sesion: dentro true y el nombre del usuario (o su correo si no tiene nombre)", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { name: "Ana", email: "ana@ejemplo.test" }, expires: "" } as never);
    const s = (await (await pedirSesion()).json()) as { dentro: boolean; nombre: string };
    expect(validador.check("sesion", s)).toBeUndefined();
    expect(s).toMatchObject({ dentro: true, nombre: "Ana", exigida: false });
    vi.mocked(getSession).mockResolvedValue({ user: { email: "ana@ejemplo.test" }, expires: "" } as never);
    expect(await (await pedirSesion()).json()).toMatchObject({ dentro: true, nombre: "ana@ejemplo.test" });
  });

  it("si la sesion no se puede leer (Postgres caido) responde como sin sesion y lo registra", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("Can't reach database server"));
    const r = await pedirSesion();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ dentro: false, nombre: "" });
    expect(console.error).toHaveBeenCalled();
  });

  it("local exige XPAND_MODO_LOCAL=1 y escucha en loopback", async () => {
    vi.stubEnv("XPAND_MODO_LOCAL", "1");
    vi.stubEnv("XPAND_WEB_HOST", "0.0.0.0");
    expect(await (await pedirSesion()).json()).toMatchObject({ local: false });
    vi.stubEnv("XPAND_WEB_HOST", "127.0.0.1");
    expect(await (await pedirSesion()).json()).toMatchObject({ local: true });
    vi.stubEnv("XPAND_MODO_LOCAL", "");
    expect(await (await pedirSesion()).json()).toMatchObject({ local: false });
  });
});

describe("decidirLocal (R14: opt-in explicito; por defecto false)", () => {
  it.each(["127.0.0.1", "localhost", "::1"])("XPAND_MODO_LOCAL=1 y escucha solo en %s: true", (host) => {
    expect(decidirLocal({ XPAND_MODO_LOCAL: "1", XPAND_WEB_HOST: host })).toBe(true);
  });

  it.each([["0.0.0.0"], ["192.168.1.20"], ["::"], [""], [undefined]])(
    "XPAND_MODO_LOCAL=1 pero escucha en %s (o no se sabe): false",
    (host) => {
      expect(decidirLocal({ XPAND_MODO_LOCAL: "1", XPAND_WEB_HOST: host })).toBe(false);
    },
  );

  it.each([[undefined], [""], ["0"], ["true"], ["si"]])(
    "en loopback pero XPAND_MODO_LOCAL=%s (no exactamente 1): false",
    (modo) => {
      expect(decidirLocal({ XPAND_MODO_LOCAL: modo, XPAND_WEB_HOST: "127.0.0.1" })).toBe(false);
    },
  );

  it("sin ninguna variable (p. ej. server.js standalone): false", () => {
    expect(decidirLocal({})).toBe(false);
  });
});
