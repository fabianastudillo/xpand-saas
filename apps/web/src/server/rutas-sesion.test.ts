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

  it("local sale de la direccion de escucha: en 0.0.0.0 es false para todos", async () => {
    vi.stubEnv("XPAND_WEB_HOST", "0.0.0.0");
    expect(await (await pedirSesion()).json()).toMatchObject({ local: false });
    vi.stubEnv("XPAND_WEB_HOST", "127.0.0.1");
    expect(await (await pedirSesion()).json()).toMatchObject({ local: true });
  });
});

describe("decidirLocal", () => {
  it.each(["127.0.0.1", "localhost", "::1"])("escuchando solo en %s toda conexion es de esta maquina", (host) => {
    expect(decidirLocal({ XPAND_WEB_HOST: host })).toBe(true);
  });

  it.each([["0.0.0.0"], ["192.168.1.20"], ["::"], [""], [undefined]])(
    "escuchando en %s (o sin saberlo) no se puede afirmar: false",
    (host) => {
      expect(decidirLocal({ XPAND_WEB_HOST: host })).toBe(false);
    },
  );
});
