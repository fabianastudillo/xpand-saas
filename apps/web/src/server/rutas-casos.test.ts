import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/libs/auth/auth-utils", () => ({ getSession: vi.fn() }));

import { createSchemaValidator } from "@xpand/api/validate";
import { getSession } from "@/libs/auth/auth-utils";
import { GET as getCatalogo } from "@/app/api/catalogo/route";
import { GET as getRed } from "@/app/api/red/route";
import { reiniciarAlmacenParaPruebas } from "@/server/casos";

const ALMACEN = fileURLToPath(new URL("../../../../packages/casos/test/almacen", import.meta.url));
const validador = createSchemaValidator();
const SESION_USUARIO = { user: { name: "Usuaria", email: "u@ejemplo.test", role: "USER" }, expires: "2099-01-01" };

interface CuerpoCatalogo {
  motores: { id: string; sistemas: { id: string }[] }[];
  aviso?: string;
  codigo_aviso?: string;
}

const pedirRed = (consulta: string) => getRed(new Request(`http://127.0.0.1:8870/api/red?${consulta}`));

async function cuerpo(respuesta: Response): Promise<unknown> {
  return (await respuesta.json()) as unknown;
}

function usarAlmacen(dir: string) {
  vi.stubEnv("XPAND_ALMACEN", dir);
  reiniciarAlmacenParaPruebas();
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  usarAlmacen(ALMACEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  reiniciarAlmacenParaPruebas();
});

describe("GET /api/catalogo", () => {
  it("valida, agrupa por motor y trae los casos publicos pero nunca el interno", async () => {
    const r = await getCatalogo();
    expect(r.status).toBe(200);
    const c = (await cuerpo(r)) as CuerpoCatalogo;
    expect(validador.check("catalogo", c)).toBeUndefined();
    expect(c.motores.map((m) => m.id)).toStrictEqual(["fp_dc", "jump_misocp"]);
    const ids = c.motores.flatMap((m) => m.sistemas.map((s) => `${m.id}/${s.id}`));
    expect(ids).toContain("jump_misocp/tnep_garver6");
    expect(ids).toContain("fp_dc/tnep_garver6");
    expect(ids).not.toContain("jump_misocp/sintetico_interno");
    expect(JSON.stringify(c)).not.toContain("sintetico_interno");
  });

  it("con sesion de usuario normal tampoco aparece el interno (misma respuesta que sin sesion)", async () => {
    const sin = await cuerpo(await getCatalogo());
    vi.mocked(getSession).mockResolvedValue(SESION_USUARIO as never);
    const con = await cuerpo(await getCatalogo());
    expect(con).toStrictEqual(sin);
  });

  it("los motivos de los casos descartados van al registro del servidor, nunca a la respuesta", async () => {
    const texto = JSON.stringify(await cuerpo(await getCatalogo()));
    expect(texto).not.toContain("tnep_invalido");
    expect(texto).not.toContain(ALMACEN);
    const registrado = vi.mocked(console.warn).mock.calls.flat().join("\n");
    expect(registrado).toContain("tnep_invalido");
  });

  it("almacen inexistente: catalogo vacio con un aviso generico, sin la ruta", async () => {
    usarAlmacen(path.join(tmpdir(), "xpand-almacen-que-no-existe-7c1f"));
    const r = await getCatalogo();
    expect(r.status).toBe(200);
    const c = (await cuerpo(r)) as CuerpoCatalogo;
    expect(c.motores).toStrictEqual([]);
    expect(validador.check("catalogo", c)).toBeUndefined();
    expect(c.aviso).toEqual(expect.any(String));
    expect(c.codigo_aviso).toBe("vacio");
    expect(JSON.stringify(c)).not.toContain("xpand-almacen-que-no-existe");
  });

  it("el aviso llega con su codigo estable: el almacen de prueba tiene casos descartados", async () => {
    const c = (await cuerpo(await getCatalogo())) as CuerpoCatalogo;
    expect(validador.check("catalogo", c)).toBeUndefined();
    expect(c.aviso).toEqual(expect.any(String));
    expect(c.codigo_aviso).toBe("descartados");
  });
});

describe("GET /api/red", () => {
  it("Garver 6 (tec=ac) valida contra el contrato; Barra 2 pd 240, qd 72", async () => {
    const r = await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac");
    expect(r.status).toBe(200);
    const red = (await cuerpo(r)) as { barras: { id: string; pd: number; qd: number }[] };
    expect(validador.check("red", red)).toBeUndefined();
    expect(red.barras.find((b) => b.id === "2")).toMatchObject({ pd: 240, qd: 72 });
  });

  it("interno, inexistente o con rutas en el id: el mismo 404 caso_no_encontrado, con o sin sesion", async () => {
    const consultas = [
      "motor=jump_misocp&sistema=sintetico_interno&tec=ac",
      "motor=jump_misocp&sistema=no_existe&tec=ac",
      "motor=jump_misocp&sistema=../x&tec=ac",
      "motor=jump_misocp&sistema=%2e%2e%2f%2e%2e%2fetc&tec=ac",
      "motor=jump_misocp&sistema=tnep_garver6%00&tec=ac",
      "motor=..&sistema=tnep_garver6&tec=ac",
      "motor=jump_misocp&tec=ac",
      "sistema=tnep_garver6&tec=ac",
    ];
    const esperado = { error: { codigo: "caso_no_encontrado", mensaje: expect.any(String) as unknown } };
    const cuerpos: unknown[] = [];
    for (const sesion of [null, SESION_USUARIO]) {
      vi.mocked(getSession).mockResolvedValue(sesion as never);
      for (const q of consultas) {
        const r = await pedirRed(q);
        expect(r.status, q).toBe(404);
        const b = await cuerpo(r);
        expect(b, q).toStrictEqual(esperado);
        cuerpos.push(b);
      }
    }
    // Sin oraculo de existencia: el interno responde byte a byte como el inexistente.
    expect(new Set(cuerpos.map((b) => JSON.stringify(b))).size).toBe(1);
  });

  it("caso truncado: 500 lector_fallo sin rutas del disco; el catalogo y los demas casos siguen", async () => {
    const r = await pedirRed("motor=jump_misocp&sistema=tnep_truncado&tec=ac");
    expect(r.status).toBe(500);
    const b = (await cuerpo(r)) as { error: { codigo: string; mensaje: string } };
    expect(b.error.codigo).toBe("lector_fallo");
    expect(JSON.stringify(b)).not.toContain(ALMACEN);
    expect(Object.keys(b)).toStrictEqual(["error"]);
    expect((await getCatalogo()).status).toBe(200);
    expect((await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac")).status).toBe(200);
    // El mismo fallo en la siguiente peticion (cache negativa), con el mismo cuerpo.
    const r2 = await pedirRed("motor=jump_misocp&sistema=tnep_truncado&tec=ac");
    expect(r2.status).toBe(500);
    expect(await cuerpo(r2)).toStrictEqual(b);
  });

  it("cache negativa: un caso roto se lee y se registra una vez por carga del almacen, no en cada peticion", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    vi.stubEnv("XPAND_ALMACEN_TTL_S", "30");
    usarAlmacen(ALMACEN);
    const registrosDelTruncado = () =>
      vi.mocked(console.error).mock.calls.filter((c) => c.join(" ").includes("tnep_truncado")).length;
    for (let i = 0; i < 5; i++) expect((await pedirRed("motor=jump_misocp&sistema=tnep_truncado&tec=ac")).status).toBe(500);
    expect(registrosDelTruncado()).toBe(1);
    vi.setSystemTime(new Date(Date.now() + 31_000)); // relectura: la cache negativa se tira y se vuelve a intentar
    expect((await pedirRed("motor=jump_misocp&sistema=tnep_truncado&tec=ac")).status).toBe(500);
    expect(registrosDelTruncado()).toBe(2);
  });

  it.each(["tec=hvdc", "tec=ac,hvdc", "tec=", ""])("%s: 400 tec_no_soportada (antes de mirar el caso)", async (tec) => {
    for (const sistema of ["tnep_garver6", "sintetico_interno"]) {
      const r = await pedirRed(`motor=jump_misocp&sistema=${sistema}&${tec}`);
      expect(r.status).toBe(400);
      expect(await cuerpo(r)).toStrictEqual({ error: { codigo: "tec_no_soportada", mensaje: expect.any(String) as unknown } });
    }
  });
});

describe("catalogo: solo campos publicos del manifiesto", () => {
  it("nunca sirve origen, visibilidad, archivos ni claves fuera de la lista de campos publicos", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "xpand-almacen-"));
    try {
      const destino = path.join(dir, "jump_misocp", "tnep_garver6");
      cpSync(path.join(ALMACEN, "jump_misocp", "tnep_garver6"), destino, { recursive: true });
      const m = JSON.parse(readFileSync(path.join(destino, "manifiesto.json"), "utf8")) as Record<string, Record<string, unknown>>;
      m.motor = { ...m.motor, raiz: "/disco/motor-secreto", codigo: [["a", "b"]] };
      m.sistema = {
        ...m.sistema,
        raiz: "/disco/sistema-secreto",
        extra: { datos_motor: "carpeta-secreta" },
        referencias: [{ valor: 1, tecnologias: "ac", ruta_interna: "/disco/ref-secreta" }],
      };
      m.clave_suelta = { nota: "campo-suelto-secreto" };
      writeFileSync(path.join(destino, "manifiesto.json"), JSON.stringify(m));
      usarAlmacen(dir);
      const c = (await cuerpo(await getCatalogo())) as { motores: { sistemas: { referencias?: unknown[] }[] }[] };
      expect(validador.check("catalogo", c)).toBeUndefined();
      const texto = JSON.stringify(c);
      for (const prohibido of ["origen", "visibilidad", "archivos", "raiz", "codigo", "extra", "ruta_interna", "secret", "XPAND-PLEXSYS", "b4c853fe"]) {
        expect(texto).not.toContain(prohibido);
      }
      expect(c.motores[0]?.sistemas[0]?.referencias).toStrictEqual([{ valor: 1, tecnologias: "ac" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("catalogo: referencias del manifiesto", () => {
  it("una referencia sin valor numerico no se sirve (el contrato lo exige) y se registra; las demas si", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "xpand-almacen-"));
    try {
      const destino = path.join(dir, "jump_misocp", "tnep_garver6");
      cpSync(path.join(ALMACEN, "jump_misocp", "tnep_garver6"), destino, { recursive: true });
      const m = JSON.parse(readFileSync(path.join(destino, "manifiesto.json"), "utf8")) as { sistema: Record<string, unknown> };
      m.sistema.referencias = [{ valor: 6212.454699999999, tecnologias: "ac" }, { valor: null, tecnologias: "ac,bancos" }];
      writeFileSync(path.join(destino, "manifiesto.json"), JSON.stringify(m));
      usarAlmacen(dir);
      const c = (await cuerpo(await getCatalogo())) as { motores: { sistemas: { referencias?: unknown[] }[] }[] };
      expect(validador.check("catalogo", c)).toBeUndefined();
      expect(c.motores[0]?.sistemas[0]?.referencias).toStrictEqual([{ valor: 6212.454699999999, tecnologias: "ac" }]);
      expect(vi.mocked(console.warn).mock.calls.flat().join("\n")).toContain("1 referencias sin valor numerico");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("relectura del almacen (TTL) y cache de redes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "xpand-almacen-"));
    cpSync(path.join(ALMACEN, "jump_misocp", "tnep_garver6"), path.join(dir, "jump_misocp", "tnep_garver6"), { recursive: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    vi.stubEnv("XPAND_ALMACEN_TTL_S", "30");
    usarAlmacen(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const manifiesto = () => path.join(dir, "jump_misocp", "tnep_garver6", "manifiesto.json");
  const pasarSegundos = (s: number) => vi.setSystemTime(new Date(Date.now() + s * 1000));

  it("un caso que pasa a interno deja de servirse tras el TTL, no antes", async () => {
    expect((await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac")).status).toBe(200);
    writeFileSync(manifiesto(), readFileSync(manifiesto(), "utf8").replace('"publico"', '"interno"'));
    pasarSegundos(10);
    expect((await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac")).status).toBe(200);
    pasarSegundos(25);
    expect((await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac")).status).toBe(404);
    const c = (await cuerpo(await getCatalogo())) as CuerpoCatalogo;
    expect(c.motores).toStrictEqual([]);
  });

  it("la red se sirve de la cache hasta la relectura, que la invalida", async () => {
    const base = path.join(dir, "jump_misocp", "tnep_garver6", "base.dat");
    const pd2 = async () =>
      ((await cuerpo(await pedirRed("motor=jump_misocp&sistema=tnep_garver6&tec=ac"))) as { barras: { id: string; pd: number }[] }).barras.find(
        (b) => b.id === "2",
      )?.pd;
    expect(await pd2()).toBe(240);
    writeFileSync(base, readFileSync(base, "utf8").replace(/^(\s*2\s+1\s+)2\.40/m, "$12.50"));
    expect(await pd2()).toBe(240);
    pasarSegundos(31);
    expect(await pd2()).toBe(250);
  });
});
