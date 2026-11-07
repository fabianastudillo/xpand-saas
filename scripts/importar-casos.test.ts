// Pruebas del importador de casos sin Julia ni datos de xpand: un volcado del catalogo escrito aqui y un checkout
// falso en una carpeta temporal, con los .dat publicos del Garver 6 de packages/casos/test/almacen.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirAlmacen, construirRed, type Caso, type Manifiesto } from "@xpand/casos";
import { importarCasos, leerListaBlanca, parsearArgs, type ListaBlanca, type Volcado } from "./importar-casos";

const GARVER = fileURLToPath(new URL("../packages/casos/test/almacen/jump_misocp/tnep_garver6", import.meta.url));
const FICHEROS_GARVER = ["base.dat", "candidates_ac.dat", "caps.dat", "dc.dat", "facts.dat", "svc.dat", "tcsc.dat"];
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const FORMULACION = "Relajacion conica de prueba";

let tmp: string;
let xpand: string;
let almacen: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "importar-casos-"));
  xpand = path.join(tmp, "xpand");
  almacen = path.join(tmp, "almacen");
  const garver = path.join(xpand, "data/casos/misocp_tnep/garver6");
  mkdirSync(garver, { recursive: true });
  for (const f of FICHEROS_GARVER) cpSync(path.join(GARVER, f), path.join(garver, f));
  // Junto al base.dat sin estar en `archivos`: el lector los abre (econ.dat, geo.json); LEEME.md no se lee.
  writeFileSync(path.join(garver, "econ.dat"), "param irate := 0.1;\n");
  writeFileSync(path.join(garver, "geo.json"), JSON.stringify({ nombres: { "1": "Barra Uno" } }));
  writeFileSync(path.join(garver, "LEEME.md"), "notas del caso\n");
  const otro = path.join(xpand, "data/casos/misocp_tnep/otro");
  mkdirSync(otro, { recursive: true });
  cpSync(path.join(GARVER, "base.dat"), path.join(otro, "base.dat"));
  mkdirSync(path.join(xpand, "modelos/jump"), { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const dirGarver = () => path.join(xpand, "data/casos/misocp_tnep/garver6");

function archivosGarver(dir = dirGarver()): Record<string, string> {
  return {
    base: path.join(dir, "base.dat"),
    ac: path.join(dir, "candidates_ac.dat"),
    hvdc: path.join(dir, "dc.dat"),
    bancos: path.join(dir, "caps.dat"),
  };
}

interface SistemaPrueba {
  id: string;
  archivos: Record<string, string | string[]>;
  [k: string]: unknown;
}

function sistema(id: string, archivos: Record<string, string | string[]>, extra: Record<string, unknown> = {}): SistemaPrueba {
  return {
    id,
    nombre: `Sistema ${id}`,
    barras: 6,
    dificultad: "rapido",
    nota: "Nota publica.",
    familia: "Garver 6 barras",
    variante: "benchmark",
    fuente: "Garver (1970)",
    modelo_datos: "ac",
    tecnologias_datos: ["ac", "hvdc"],
    disponible: true,
    datos_motor: "misocp_tnep",
    archivos,
    ...extra,
  };
}

function volcado(sistemas: SistemaPrueba[], motor: Record<string, unknown> = {}): Volcado {
  return {
    motores: [
      {
        id: "jump_misocp",
        nombre: "MISOCP AC/DC",
        familia: "convexo",
        formulacion: FORMULACION,
        esquema_red: "misocp",
        raiz: path.join(xpand, "modelos/jump"),
        sistemas,
        ...motor,
      },
    ],
  };
}

const LISTA: ListaBlanca = leerListaBlanca(
  JSON.stringify({
    sistemas: [{ sistema: "tnep_garver6", datos: "data/casos/misocp_tnep/garver6", fuente: "Garver (1970), IEEE Trans. PAS 89(7)" }],
  }),
);

function importar(v: Volcado, opts: { incluirInternos?: boolean; lista?: ListaBlanca; destino?: string } = {}) {
  return importarCasos({
    xpand,
    almacen: opts.destino ?? almacen,
    volcado: v,
    listaBlanca: opts.lista ?? LISTA,
    incluirInternos: opts.incluirInternos ?? false,
    commit: COMMIT,
  });
}

/** Huella de un arbol: rutas relativas, tipo y contenido de cada fichero. */
function huella(dir: string): string {
  const h = createHash("sha256");
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      h.update(`${path.relative(dir, p)}|${e.isDirectory() ? "d" : e.isSymbolicLink() ? "l" : "f"}\n`);
      if (e.isDirectory()) recorrer(p);
      else if (e.isFile()) h.update(readFileSync(p));
    }
  };
  recorrer(dir);
  return h.digest("hex");
}

function leerManifiesto(motor: string, sist: string): Manifiesto {
  return JSON.parse(readFileSync(path.join(almacen, motor, sist, "manifiesto.json"), "utf8")) as Manifiesto;
}

/** Caso que lee directamente del arbol fuente, como lo leeria xpand (base y vecinos en su carpeta). */
function casoFuente(m: Manifiesto, dir: string, archivos: Record<string, string>): Caso {
  const rel = Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, path.basename(v)]));
  return {
    manifiesto: { ...m, archivos: rel },
    leer: (r) => {
      try {
        return readFileSync(path.join(dir, r), "utf8");
      } catch {
        return undefined;
      }
    },
    ruta: (k) => (rel[k] === undefined ? [] : [rel[k]]),
  };
}

describe("importarCasos: caso publico", () => {
  it("escribe un manifiesto valido que el almacen abre como publico, sin rutas del disco", async () => {
    const informe = await importar(volcado([sistema("tnep_garver6", archivosGarver())]));

    expect(informe.importados).toEqual([{ motor: "jump_misocp", sistema: "tnep_garver6", visibilidad: "publico" }]);
    const abierto = await abrirAlmacen(almacen);
    expect(abierto.detalles).toEqual([]);
    const caso = abierto.caso("jump_misocp", "tnep_garver6", { incluirInternos: false });
    expect(caso?.manifiesto.visibilidad).toBe("publico");
    const m = leerManifiesto("jump_misocp", "tnep_garver6");
    expect(m.motor).toEqual({ id: "jump_misocp", nombre: "MISOCP AC/DC", familia: "convexo", formulacion: FORMULACION, esquema_red: "misocp" });
    expect(m.archivos).toEqual({ base: "base.dat", ac: "candidates_ac.dat", hvdc: "dc.dat", bancos: "caps.dat" });
    expect(m.origen).toEqual({ repo: "XPAND-PLEXSYS/xpand", commit: COMMIT, ruta: "data/casos/misocp_tnep/garver6" });
    expect(Object.keys(m.sistema).sort()).toEqual(
      ["barras", "dificultad", "familia", "fuente", "id", "modelo_datos", "nombre", "nota", "tecnologias_datos", "variante"].sort(),
    );
    expect(JSON.stringify(m)).not.toContain(tmp);
  });

  it("copia los ficheros declarados y los que el lector abre junto al base, y nada mas", async () => {
    const informe = await importar(volcado([sistema("tnep_garver6", archivosGarver())]));

    const copiados = readdirSync(path.join(almacen, "jump_misocp", "tnep_garver6")).sort();
    expect(copiados).toEqual(["base.dat", "candidates_ac.dat", "caps.dat", "dc.dat", "econ.dat", "geo.json", "manifiesto.json"]);
    expect(informe.ficheros).toBe(6);
  });

  it("la red construida desde el almacen es la misma que desde la carpeta de xpand", async () => {
    await importar(volcado([sistema("tnep_garver6", archivosGarver())]));

    const caso = (await abrirAlmacen(almacen)).caso("jump_misocp", "tnep_garver6", { incluirInternos: false });
    if (!caso) throw new Error("falta el caso importado");
    const desdeFuente = construirRed(casoFuente(caso.manifiesto, dirGarver(), archivosGarver()), "ac");
    const desdeAlmacen = construirRed(caso, "ac");
    expect(desdeAlmacen).toEqual(desdeFuente);
    expect((desdeAlmacen as unknown as { econ: Record<string, number> }).econ.irate).toBe(0.1);
    expect(desdeAlmacen.barras.find((b) => String(b.id) === "1")?.nombre).toBe("Barra Uno");
  });

  it("solo copia campos publicos del catalogo y limpia las referencias", async () => {
    const refs = [
      { tecnologias: "ac", valor: 200, crf: 1, formulacion: "MISOCP", fuente: "articulo", ruta_interna: "/x/y" },
      { tecnologias: "ac,hvdc", valor: "no es numero" },
    ];
    await importar(
      volcado(
        [sistema("tnep_garver6", archivosGarver(), { referencias: refs, extra: { datos_motor: "x" }, planif: "tnep", disponible: true })],
        { raiz: path.join(xpand, "modelos/jump"), modelo: "src/MotorJuMP.jl", codigo: [["a", "b"]] },
      ),
    );

    const m = leerManifiesto("jump_misocp", "tnep_garver6");
    expect(m.sistema.referencias).toEqual([{ tecnologias: "ac", valor: 200, crf: 1, formulacion: "MISOCP", fuente: "articulo" }]);
    expect(m.sistema).not.toHaveProperty("disponible");
    expect(m.sistema).not.toHaveProperty("planif");
    expect(m.motor).not.toHaveProperty("raiz");
    expect(m.motor).not.toHaveProperty("modelo");
  });

  it("conserva la forma lista de una clave de archivos", async () => {
    const dir = dirGarver();
    await importar(volcado([sistema("tnep_garver6", { base: [path.join(dir, "base.dat"), path.join(dir, "caps.dat")] })]));

    expect(leerManifiesto("jump_misocp", "tnep_garver6").archivos).toEqual({ base: ["base.dat", "caps.dat"] });
  });
});

describe("importarCasos: lista blanca y visibilidad", () => {
  it("un sistema fuera de la lista blanca no se copia ni aparece", async () => {
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro/base.dat");
    const informe = await importar(volcado([sistema("tnep_garver6", archivosGarver()), sistema("tnep_otro", { base: otro })]));

    expect(informe.importados.map((c) => c.sistema)).toEqual(["tnep_garver6"]);
    expect(informe.omitidos).toEqual([{ motivo: "no_publico", cuantos: 1 }]);
    expect(readdirSync(path.join(almacen, "jump_misocp"))).toEqual(["tnep_garver6"]);
  });

  it("con incluirInternos el sistema fuera de la lista se importa como interno", async () => {
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro/base.dat");
    await importar(volcado([sistema("tnep_garver6", archivosGarver()), sistema("tnep_otro", { base: otro })]), { incluirInternos: true });

    const abierto = await abrirAlmacen(almacen);
    expect(abierto.caso("jump_misocp", "tnep_otro", { incluirInternos: false })).toBeUndefined();
    expect(abierto.caso("jump_misocp", "tnep_otro", { incluirInternos: true })?.manifiesto.visibilidad).toBe("interno");
  });

  it("el mismo id con otros datos que los de la lista blanca no es publico", async () => {
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro/base.dat");
    const informe = await importar(volcado([sistema("tnep_garver6", { base: otro })]));

    expect(informe.importados).toEqual([]);
    expect(informe.omitidos).toEqual([{ motivo: "no_publico", cuantos: 1 }]);
  });

  it("un caso de la lista con un patron de datos internos en sus metadatos se omite", async () => {
    const informe = await importar(volcado([sistema("tnep_garver6", archivosGarver(), { nota: "Entrega del SNI de prueba" })]));

    expect(informe.importados).toEqual([]);
    expect(informe.omitidos).toEqual([{ motivo: "patron_interno", cuantos: 1 }]);
  });

  it("un caso de la lista cuyos ficheros nombran datos internos se omite", async () => {
    writeFileSync(path.join(dirGarver(), "econ.dat"), "# costos tomados del caso del SNI\nparam irate := 0.1;\n");
    const informe = await importar(volcado([sistema("tnep_garver6", archivosGarver())]));

    expect(informe.importados).toEqual([]);
    expect(informe.omitidos).toEqual([{ motivo: "patron_interno", cuantos: 1 }]);
  });

  it("omite sistemas no disponibles y motores sin formulacion ni familia", async () => {
    const sinDatos = await importar(volcado([sistema("tnep_garver6", archivosGarver(), { disponible: false })]));
    expect(sinDatos.omitidos).toEqual([{ motivo: "no_disponible", cuantos: 1 }]);

    const sinFamilia = await importar(volcado([sistema("tnep_garver6", archivosGarver())], { familia: undefined, formulacion: undefined }));
    expect(sinFamilia.omitidos).toEqual([{ motivo: "metadatos_incompletos", cuantos: 1 }]);
  });
});

describe("importarCasos: rutas", () => {
  it("rechaza un caso publico con un declarado que es enlace a una carpeta no publica del checkout", async () => {
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro");
    writeFileSync(path.join(otro, "interno.dat"), "param x := 1;\n");
    symlinkSync(path.join(otro, "interno.dat"), path.join(dirGarver(), "enlace.dat"));
    const informe = await importar(volcado([sistema("tnep_garver6", { ...archivosGarver(), extra: path.join(dirGarver(), "enlace.dat") })]));

    expect(informe.importados).toEqual([]);
    expect(informe.omitidos).toEqual([{ motivo: "fuera_de_carpeta_publica", cuantos: 1 }]);
    expect(readdirSync(almacen)).not.toContain("jump_misocp");
  });

  it("los vecinos del base salen de la carpeta publica real, no de la que declara el volcado", async () => {
    // El volcado declara un base.dat en una carpeta no publica que es un enlace al base publico: la lista blanca ve
    // la carpeta publica, pero los vecinos (econ.dat) y los demas declarados estan en la no publica.
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro");
    rmSync(path.join(otro, "base.dat"));
    symlinkSync(path.join(dirGarver(), "base.dat"), path.join(otro, "base.dat"));
    writeFileSync(path.join(otro, "econ.dat"), "param irate := 0.9;\n");
    const informe = await importar(volcado([sistema("tnep_garver6", { base: path.join(otro, "base.dat") })]));

    expect(informe.importados).toEqual([{ motor: "jump_misocp", sistema: "tnep_garver6", visibilidad: "publico" }]);
    const econ = readFileSync(path.join(almacen, "jump_misocp", "tnep_garver6", "econ.dat"), "utf8");
    expect(econ).toBe(readFileSync(path.join(dirGarver(), "econ.dat"), "utf8"));
  });

  it("rechaza un caso publico que declara ficheros de otra carpeta via ..", async () => {
    const otro = path.join(xpand, "data/casos/misocp_tnep/otro");
    writeFileSync(path.join(otro, "interno.dat"), "param x := 1;\n");
    const informe = await importar(
      volcado([sistema("tnep_garver6", { ...archivosGarver(), extra: path.join(dirGarver(), "..", "otro", "interno.dat") })]),
    );

    expect(informe.omitidos).toEqual([{ motivo: "fuera_de_carpeta_publica", cuantos: 1 }]);
  });

  it("rechaza un archivo fuera del checkout (absoluto o con ..) sin copiar nada de ese caso", async () => {
    const fuera = path.join(tmp, "fuera.dat");
    writeFileSync(fuera, "param x := 1;\n");
    for (const ruta of [fuera, "../../../fuera.dat"]) {
      const informe = await importar(volcado([sistema("tnep_garver6", { ...archivosGarver(), extra: ruta })]));

      expect(informe.importados).toEqual([]);
      expect(informe.omitidos).toEqual([{ motivo: "archivo_no_valido", cuantos: 1 }]);
      expect(readdirSync(almacen)).not.toContain("jump_misocp");
    }
  });

  it("rechaza un enlace simbolico que apunta fuera del checkout", async () => {
    const fuera = path.join(tmp, "fuera.dat");
    writeFileSync(fuera, "param x := 1;\n");
    symlinkSync(fuera, path.join(dirGarver(), "enlace.dat"));
    const informe = await importar(volcado([sistema("tnep_garver6", { ...archivosGarver(), extra: path.join(dirGarver(), "enlace.dat") })]));

    expect(informe.omitidos).toEqual([{ motivo: "archivo_no_valido", cuantos: 1 }]);
  });

  it("rechaza un archivo declarado que no existe", async () => {
    const informe = await importar(volcado([sistema("tnep_garver6", { ...archivosGarver(), extra: path.join(dirGarver(), "no_existe.dat") })]));

    expect(informe.omitidos).toEqual([{ motivo: "archivo_no_valido", cuantos: 1 }]);
  });

  it("nunca escribe dentro de --xpand", async () => {
    const antes = huella(xpand);
    await expect(importar(volcado([sistema("tnep_garver6", archivosGarver())]), { destino: path.join(xpand, "almacen") })).rejects.toThrow(
      /dentro del checkout/,
    );
    await importar(volcado([sistema("tnep_garver6", archivosGarver())]));
    expect(huella(xpand)).toBe(antes);
  });

  it("no pisa una carpeta con contenido que no escribio el importador", async () => {
    mkdirSync(almacen);
    writeFileSync(path.join(almacen, "mio.txt"), "no tocar\n");

    await expect(importar(volcado([sistema("tnep_garver6", archivosGarver())]))).rejects.toThrow(/no la escribio el importador/);
    expect(readFileSync(path.join(almacen, "mio.txt"), "utf8")).toBe("no tocar\n");
  });
});

describe("importarCasos: reimportar", () => {
  it("es idempotente", async () => {
    const v = volcado([sistema("tnep_garver6", archivosGarver())]);
    await importar(v);
    const primera = huella(almacen);
    await importar(v);
    expect(huella(almacen)).toBe(primera);
    // Sin restos de la carpeta de preparacion ni de la anterior junto al almacen.
    expect(readdirSync(tmp).sort()).toEqual(["almacen", "xpand"]);
  });

  it("retira un caso que ya no esta en la lista blanca", async () => {
    await importar(volcado([sistema("tnep_garver6", archivosGarver())]));
    expect(statSync(path.join(almacen, "jump_misocp", "tnep_garver6")).isDirectory()).toBe(true);

    await importar(volcado([sistema("tnep_garver6", archivosGarver())]), { lista: leerListaBlanca(JSON.stringify({ sistemas: [] })) });
    expect(readdirSync(almacen)).toEqual([".importador-xpand.json"]);
  });
});

describe("leerListaBlanca", () => {
  it("rechaza una lista con un caso de datos internos", () => {
    const texto = JSON.stringify({ sistemas: [{ sistema: "tnep_x", datos: "data/casos/Ecuador_2025", fuente: "x" }] });
    expect(() => leerListaBlanca(texto)).toThrow(/patron de datos internos/);
  });

  it("rechaza entradas sin fuente, con rutas que salen o repetidas", () => {
    const con = (e: unknown[]) => JSON.stringify({ sistemas: e });
    expect(() => leerListaBlanca(con([{ sistema: "a", datos: "data/a", fuente: "" }]))).toThrow(/fuente/);
    expect(() => leerListaBlanca(con([{ sistema: "a", datos: "../a", fuente: "f" }]))).toThrow(/datos/);
    expect(() => leerListaBlanca(con([{ sistema: "a", datos: "/a", fuente: "f" }]))).toThrow(/datos/);
    const e = { sistema: "a", datos: "data/a", fuente: "f" };
    expect(() => leerListaBlanca(con([e, e]))).toThrow(/repetid/);
  });

  it("la lista del repositorio es valida y no nombra datos internos", () => {
    const texto = readFileSync(fileURLToPath(new URL("../config/casos-publicos.json", import.meta.url)), "utf8");
    const lista = leerListaBlanca(texto);
    expect(lista.sistemas.length).toBeGreaterThan(0);
  });
});

describe("parsearArgs", () => {
  it("lee las opciones y exige --xpand", () => {
    expect(parsearArgs(["--xpand", "/x", "--almacen", "/a", "--incluir-internos", "--volcado", "/v.json"], {})).toEqual({
      xpand: "/x",
      almacen: "/a",
      incluirInternos: true,
      volcado: "/v.json",
    });
    expect(parsearArgs(["--xpand", "/x"], { XPAND_ALMACEN: "/env" })).toMatchObject({ almacen: "/env", incluirInternos: false });
    expect(() => parsearArgs([], {})).toThrow(/--xpand/);
    expect(() => parsearArgs(["--xpand", "/x", "--otra"], {})).toThrow(/--otra/);
  });
});
