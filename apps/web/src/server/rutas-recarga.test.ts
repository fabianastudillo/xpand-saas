import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Almacen falso: se controla cuando falla la apertura o la relectura y se cuentan las relecturas.
vi.mock("@xpand/casos", async (importOriginal) => {
  const real = await importOriginal<typeof import("@xpand/casos")>();
  return { ...real, abrirAlmacen: vi.fn() };
});

import { abrirAlmacen, type Almacen, type Caso } from "@xpand/casos";
import { GET as getCatalogo } from "@/app/api/catalogo/route";
import { GET as getRed } from "@/app/api/red/route";
import { reiniciarAlmacenParaPruebas } from "@/server/casos";

const TTL_S = 30;
const TOPE_S = 300;

function casoFalso(sistema: string): Caso {
  return {
    manifiesto: {
      motor: { id: "jump_misocp", nombre: "MISOCP", familia: "convexo", esquema_red: "misocp" },
      sistema: { id: sistema, nombre: sistema, barras: 6 },
      archivos: {},
      visibilidad: "publico",
      origen: { repo: "r", commit: "c", ruta: "x" },
    },
    leer: () => undefined,
    ruta: () => [],
  };
}

function almacenFalso(recargar: () => Promise<boolean>): Almacen & { recargar: ReturnType<typeof vi.fn> } {
  return {
    aviso: undefined,
    detalles: [],
    casos: () => [casoFalso("tnep_garver6")],
    caso: () => undefined,
    recargar: vi.fn(recargar),
  };
}

const pasar = (s: number) => vi.setSystemTime(new Date(Date.now() + s * 1000));
const sistemasDelCatalogo = async () =>
  ((await (await getCatalogo()).json()) as { motores: { sistemas: { id: string }[] }[] }).motores.flatMap((m) =>
    m.sistemas.map((s) => s.id),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
  vi.stubEnv("XPAND_ALMACEN_TTL_S", String(TTL_S));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  reiniciarAlmacenParaPruebas();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  reiniciarAlmacenParaPruebas();
});

describe("relectura fallida: espera exponencial y foto anterior", () => {
  it("una relectura que falla espera TTL, luego el doble...; al ir bien vuelve al TTL", async () => {
    const resultados = [false, false, true];
    const almacen = almacenFalso(() => Promise.resolve(resultados.shift() ?? true));
    vi.mocked(abrirAlmacen).mockResolvedValue(almacen);

    expect(await sistemasDelCatalogo()).toStrictEqual(["tnep_garver6"]);
    pasar(31);
    expect(await sistemasDelCatalogo()).toStrictEqual(["tnep_garver6"]); // relee (1), falla: foto anterior
    expect(almacen.recargar).toHaveBeenCalledTimes(1);
    pasar(29);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(1); // espera TTL (30 s) tras el primer fallo
    pasar(2);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(2); // falla otra vez: ahora espera 60 s
    pasar(59);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(2);
    pasar(2);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(3); // va bien
    pasar(29);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(3); // vuelve al TTL normal
    pasar(2);
    await getCatalogo();
    expect(almacen.recargar).toHaveBeenCalledTimes(4);
  });

  it(`la espera no pasa de ${String(TOPE_S)} s por muchos fallos seguidos`, async () => {
    const almacen = almacenFalso(() => Promise.resolve(false));
    vi.mocked(abrirAlmacen).mockResolvedValue(almacen);
    await getCatalogo();
    for (let i = 1; i <= 8; i++) {
      pasar(TOPE_S + 1);
      await getCatalogo();
      await getCatalogo();
      expect(almacen.recargar).toHaveBeenCalledTimes(i);
    }
  });

  it("una relectura que lanza: el catalogo y la red siguen con la foto anterior", async () => {
    const almacen = almacenFalso(() => Promise.reject(new Error("EIO /ruta/secreta")));
    vi.mocked(abrirAlmacen).mockResolvedValue(almacen);
    await getCatalogo();
    pasar(31);
    const r = await getCatalogo();
    expect(r.status).toBe(200);
    expect(await sistemasDelCatalogo()).toStrictEqual(["tnep_garver6"]);
    const red = await getRed(new Request("http://127.0.0.1:8870/api/red?motor=jump_misocp&sistema=x&tec=ac"));
    expect(red.status).toBe(404); // el almacen falso no tiene ese caso: responde, no revienta
    expect(almacen.recargar).toHaveBeenCalledTimes(1);
  });

  it("si el almacen no se puede abrir: 503 almacen_no_disponible con la forma unica, sin la causa; se reintenta con espera", async () => {
    vi.mocked(abrirAlmacen).mockRejectedValue(new Error("EACCES /ruta/secreta"));
    for (const r of [
      await getCatalogo(),
      await getRed(new Request("http://127.0.0.1:8870/api/red?motor=jump_misocp&sistema=tnep_garver6&tec=ac")),
    ]) {
      expect(r.status).toBe(503);
      const b = (await r.json()) as unknown;
      expect(b).toStrictEqual({ error: { codigo: "almacen_no_disponible", mensaje: expect.any(String) as unknown } });
      expect(JSON.stringify(b)).not.toContain("secreta");
    }
    expect(abrirAlmacen).toHaveBeenCalledTimes(1);
    pasar(31);
    vi.mocked(abrirAlmacen).mockResolvedValue(almacenFalso(() => Promise.resolve(true)));
    expect((await getCatalogo()).status).toBe(200);
    expect(abrirAlmacen).toHaveBeenCalledTimes(2);
  });
});
