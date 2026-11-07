import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { redGfmgfl, redHidro, redMatpower, redMisocp, redReal } from "@xpand/core";
import { createSchemaValidator } from "@xpand/api/validate";
import type { Red } from "@xpand/api/red-wire";
import { abrirAlmacen, type Almacen, type Caso, type Manifiesto } from "./almacen";
import { construirRed, LectorError } from "./red";

const ALMACEN = fileURLToPath(new URL("../test/almacen", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../../core/fixtures", import.meta.url));
const SIN_INTERNOS = { incluirInternos: false };
const validador = createSchemaValidator();

const ejemploRed = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../contracts/api/examples/red.json", import.meta.url)), "utf8"),
) as Red;
const ejemploCatalogo = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../contracts/api/examples/catalogo.json", import.meta.url)), "utf8"),
) as { motores: { id: string; sistemas: { id: string; barras: number }[] }[] };

// Campos del contrato (contracts/api/README.md) por coleccion; `nombre` es opcional pero el ejemplo lo trae.
const CAMPOS = {
  barras: ["id", "etiqueta", "nombre", "kv", "pd", "qd", "vmin", "vmax"],
  ac_existentes: ["id", "de", "a", "r", "x", "s"],
  ac_candidatos: ["id", "de", "a", "r", "x", "s", "costo", "nmax"],
} as const;

function porId(lista: readonly { id: unknown }[]): Map<string, Record<string, unknown>> {
  return new Map(lista.map((r) => [String(r.id), r as Record<string, unknown>]));
}

function casoDe(almacen: Almacen, motor: string, sistema: string): Caso {
  const caso = almacen.caso(motor, sistema, SIN_INTERNOS);
  if (!caso) throw new Error(`falta el caso de prueba ${motor}/${sistema}`);
  return caso;
}

// Caso en memoria: lo justo de la interfaz Caso para probar el despacho por esquema sin tocar el almacen.
function casoEnMemoria(esquema: string, archivos: Record<string, string>, ficheros: Record<string, string>): Caso {
  const manifiesto: Manifiesto = {
    motor: { id: "m", nombre: "M", familia: "f", esquema_red: esquema },
    sistema: { id: "s", nombre: "S", barras: 0 },
    archivos,
    visibilidad: "publico",
    origen: { repo: "r", commit: "c", ruta: "x" },
  };
  return {
    manifiesto,
    leer: (ruta) => ficheros[ruta],
    ruta: (clave) => (archivos[clave] === undefined ? [] : [archivos[clave]]),
  };
}

const fixture = (rel: string) => readFileSync(`${FIXTURES}/${rel}`, "utf8");

describe("construirRed: Garver 6 de jump_misocp (tec=ac)", () => {
  let red: Red;
  beforeAll(async () => {
    red = construirRed(casoDe(await abrirAlmacen(ALMACEN), "jump_misocp", "tnep_garver6"), "ac");
  });

  it("valida contra red.schema.json", () => {
    expect(validador.check("red", red)).toBeUndefined();
  });

  it("Barra 2: pd 240 y qd 72 (MW/Mvar sobre Sbase 100)", () => {
    const b2 = red.barras.find((b) => String(b.id) === "2");
    expect(b2?.pd).toBe(240);
    expect(b2?.qd).toBe(72);
  });

  it.each(Object.keys(CAMPOS) as (keyof typeof CAMPOS)[])(
    "%s: cada registro del ejemplo de xpand coincide en los campos del contrato",
    (coleccion) => {
      const nuestros = porId(red[coleccion]);
      const deXpand = porId(ejemploRed[coleccion]);
      expect(deXpand.size).toBeGreaterThan(0);
      for (const [id, ref] of deXpand) {
        const fila = nuestros.get(id);
        expect(fila, `${coleccion} ${id}`).toBeDefined();
        for (const campo of CAMPOS[coleccion]) expect(fila?.[campo], `${coleccion} ${id}.${campo}`).toStrictEqual(ref[campo]);
      }
    },
  );

  it("barras y lineas existentes son las del ejemplo completo (el ejemplo solo recorta candidatos)", () => {
    expect([...porId(red.barras).keys()]).toStrictEqual([...porId(ejemploRed.barras).keys()]);
    expect([...porId(red.ac_existentes).keys()]).toStrictEqual([...porId(ejemploRed.ac_existentes).keys()]);
    expect(red.ac_candidatos).toHaveLength(15);
  });

  it("escalares de la cabecera iguales a los de xpand", () => {
    for (const k of ["motor", "sistema", "nombre_sistema", "esquema", "refbus", "sbase", "theta_max_deg", "dtheta_max_deg"]) {
      expect(red[k], k).toStrictEqual(ejemploRed[k]);
    }
  });

  it("filtro de tecnologia: con solo ac se vacian las demas y se anotan en tec_filtradas, como en xpand", () => {
    expect(red.tec_filtradas).toStrictEqual([
      "bancos", "statcom", "sssc", "tcsc", "svc", "bess", "ibr", "proyectos_gen", "ramas_dc", "convertidores", "nodos_dc",
    ]);
    for (const k of red.tec_filtradas as string[]) expect(red[k], k).toStrictEqual([]);
  });
});

describe("construirRed: Garver 6 de fp_dc (esquema matpower sin .m)", () => {
  let red: Red;
  beforeAll(async () => {
    red = construirRed(casoDe(await abrirAlmacen(ALMACEN), "fp_dc", "tnep_garver6"), "ac");
  });

  it("valida y su numero de barras es el de catalogo.json", () => {
    expect(validador.check("red", red)).toBeUndefined();
    const sistema = ejemploCatalogo.motores.find((m) => m.id === "fp_dc")?.sistemas.find((s) => s.id === "tnep_garver6");
    expect(sistema?.barras).toBe(6);
    expect(red.barras).toHaveLength(sistema?.barras ?? -1);
  });

  it("sigue la via .dat como xpand y, por ser esquema matpower, no aplica el filtro de tecnologia", () => {
    expect(red.esquema).toBe("misocp");
    expect(red).not.toHaveProperty("tec_filtradas");
    expect(red.motor).toBe("fp_dc");
  });
});

describe("construirRed: casos que el lector no puede leer", () => {
  it("un base.dat truncado (tabla sin «;» final) lanza LectorError lector_fallo, sin rutas absolutas", async () => {
    const caso = casoDe(await abrirAlmacen(ALMACEN), "jump_misocp", "tnep_truncado");
    let error: unknown;
    try {
      construirRed(caso, "ac");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(LectorError);
    expect((error as LectorError).codigo).toBe("lector_fallo");
    expect((error as LectorError).message).toContain("base.dat");
    expect((error as LectorError).message).not.toContain(ALMACEN);
    expect((error as LectorError).message).not.toMatch(/\/caso\//);
  });

  it("un fichero declarado en archivos que no existe lanza LectorError", () => {
    const caso = casoEnMemoria("misocp", { base: "base.dat", ac: "candidates_ac.dat" }, { "base.dat": "param Sbase := 100;\n" });
    expect(() => construirRed(caso, "ac")).toThrow(LectorError);
  });

  it("un fichero declarado de una tecnologia no pedida no se lee (no falla aunque falte)", () => {
    const caso = casoEnMemoria("misocp", { base: "base.dat", hvdc: "dc.dat" }, { "base.dat": "param Sbase := 100;\n" });
    expect(() => construirRed(caso, "ac")).not.toThrow();
  });

  it("un comentario tras el ultimo «;» no es truncamiento", () => {
    const caso = casoEnMemoria("misocp", { base: "base.dat" }, { "base.dat": "param Sbase := 100;\n# fin ; sin nada mas\n  \n" });
    expect(() => construirRed(caso, "ac")).not.toThrow();
  });

  it("un error del lector se envuelve en LectorError con la causa", () => {
    const caso = casoEnMemoria("hidro", { base: "etapas/etapas.csv" }, { "etapas/etapas.csv": "etapa,demanda_GWh,horas\n2,1,1\n" });
    expect(() => construirRed(caso, "ac")).toThrow(LectorError);
  });
});

describe("construirRed: despacho por esquema_red, como construir_red de xpand", () => {
  const META = { motor: "m", sistema: "s", nombre_sistema: "S" };

  it("matpower con .m: red_matpower del .m, sin filtro de tecnologia", () => {
    const m = fixture("matpower/garver6_hvdc_pm/input.m");
    const red = construirRed(casoEnMemoria("matpower", { m: "caso.m" }, { "caso.m": m }), "ac");
    expect(red).toStrictEqual({ ...redMatpower(m), ...META });
  });

  it("real: red_real del fichero «red»", () => {
    const texto = fixture("red/real/sintetico/input.json");
    const red = construirRed(casoEnMemoria("real", { red: "red.json" }, { "red.json": texto }), "ac");
    expect(red.barras).toStrictEqual(redReal(texto).barras);
    expect(red.motor).toBe("m");
  });

  it("gfmgfl: red_gfmgfl de base + horizonte", () => {
    const texto = fixture("red/gfmgfl/sintetico/input.dat");
    const red = construirRed(casoEnMemoria("gfmgfl", { base: "base.dat" }, { "base.dat": texto }), "ac");
    expect(red.barras).toStrictEqual(redGfmgfl(["/caso/base.dat"], () => texto).barras);
  });

  it("hidro: red_hidro del primer fichero «base»", () => {
    const dir = "red/hidro/sintetico/input";
    const ficheros = {
      "etapas/etapas.csv": fixture(`${dir}/etapas/etapas.csv`),
      "centrales_hidro.csv": fixture(`${dir}/centrales_hidro.csv`),
      "centrales_termicas.csv": fixture(`${dir}/centrales_termicas.csv`),
    };
    const red = construirRed(casoEnMemoria("hidro", { base: "etapas/etapas.csv" }, ficheros), "ac");
    const directa = redHidro("/caso/etapas/etapas.csv", (r) => ficheros[r.slice("/caso/".length) as keyof typeof ficheros]);
    expect(red.barras).toStrictEqual(directa.barras);
  });

  it("misocp: base + ac + extra en ese orden; el overlay extra pisa a la base", () => {
    const base = "param Sbase := 100;\nparam: BUS: bus_type Pd Qd :=\n 1 3 0.5 0.1\n;\n";
    const extra = "param theta_max_rad := 0.5;\n";
    const caso = casoEnMemoria("misocp", { base: "base.dat", extra: "econ_extra.dat" }, { "base.dat": base, "econ_extra.dat": extra });
    const red = construirRed(caso, "ac");
    const directa = redMisocp(["/caso/base.dat", "/caso/econ_extra.dat"], (r) =>
      ({ "/caso/base.dat": base, "/caso/econ_extra.dat": extra })[r],
    );
    expect(red.barras).toStrictEqual(directa.barras);
    expect(red.theta_max_deg).toStrictEqual(directa.theta_max_deg);
    expect(red.theta_max_deg).toBeCloseTo((0.5 * 180) / Math.PI, 12);
  });

  it("los nombres de geo.json junto al caso pasan a etiqueta y nombre de la barra", () => {
    const base = "param Sbase := 100;\nparam: BUS: bus_type Pd Qd :=\n 1 3 0 0\n 2 1 0 0\n;\n";
    const geo = JSON.stringify({ nombres: { "2": "Subestacion Dos", "1": "" } });
    const red = construirRed(casoEnMemoria("misocp", { base: "base.dat" }, { "base.dat": base, "geo.json": geo }), "ac");
    const [b1, b2] = red.barras;
    expect(b1).toMatchObject({ etiqueta: "1", nombre: "1" });
    expect(b2).toMatchObject({ etiqueta: "Subestacion Dos", nombre: "Subestacion Dos" });
  });
});
