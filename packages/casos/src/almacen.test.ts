import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abrirAlmacen, type Almacen } from "./almacen";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test/almacen");
const SIN_INTERNOS = { incluirInternos: false };
const CON_INTERNOS = { incluirInternos: true };

let copia: string;
let almacen: Almacen;

beforeAll(async () => {
  // Copia temporal: los enlaces simbolicos de las pruebas no se versionan.
  copia = await mkdtemp(path.join(tmpdir(), "xpand-almacen-"));
  await cp(FIXTURE, path.join(copia, "almacen"), { recursive: true });
  const raiz = path.join(copia, "almacen");
  await writeFile(path.join(copia, "secreto.txt"), "fuera del almacen");
  await symlink(path.join(copia, "secreto.txt"), path.join(raiz, "jump_misocp/tnep_garver6/enlace.dat"));
  await symlink(copia, path.join(raiz, "jump_misocp/tnep_garver6/enlace_dir"));
  almacen = await abrirAlmacen(raiz);
});

afterAll(async () => {
  await rm(copia, { recursive: true, force: true });
});

describe("listado y visibilidad", () => {
  it("lista los dos publicos y oculta el interno", () => {
    const ids = almacen.casos(SIN_INTERNOS).map((c) => `${c.manifiesto.motor.id}/${c.manifiesto.sistema.id}`);
    expect(ids).toContain("jump_misocp/tnep_garver6");
    expect(ids).toContain("fp_dc/tnep_garver6");
    expect(ids).not.toContain("jump_misocp/sintetico_interno");
  });

  it("incluye el interno solo con incluirInternos", () => {
    const ids = almacen.casos(CON_INTERNOS).map((c) => c.manifiesto.sistema.id);
    expect(ids).toContain("sintetico_interno");
  });

  it("caso() no devuelve un interno sin incluirInternos", () => {
    expect(almacen.caso("jump_misocp", "sintetico_interno", SIN_INTERNOS)).toBeUndefined();
    expect(almacen.caso("jump_misocp", "sintetico_interno", CON_INTERNOS)?.manifiesto.visibilidad).toBe("interno");
  });

  it("devuelve el manifiesto validado", () => {
    const caso = almacen.caso("jump_misocp", "tnep_garver6", SIN_INTERNOS);
    expect(caso?.manifiesto.motor.esquema_red).toBe("misocp");
    expect(caso?.manifiesto.archivos["base"]).toBe("base.dat");
    expect(caso?.manifiesto.origen.repo).toBe("XPAND-PLEXSYS/xpand");
    expect(almacen.caso("fp_dc", "tnep_garver6", SIN_INTERNOS)?.manifiesto.motor.esquema_red).toBe("matpower");
  });

  it("descarta un manifiesto invalido con aviso sin romper el almacen", () => {
    expect(almacen.caso("jump_misocp", "tnep_invalido", CON_INTERNOS)).toBeUndefined();
    expect(almacen.aviso).toMatch(/tnep_invalido/);
    expect(almacen.casos(CON_INTERNOS).length).toBeGreaterThanOrEqual(3);
  });

  it("descarta un manifiesto cuyas carpetas no coinciden con sus ids", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-ids-"));
    try {
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), path.join(raiz, "fp_dc/otro"), { recursive: true });
      const a = await abrirAlmacen(raiz);
      expect(a.casos(CON_INTERNOS)).toHaveLength(0);
      expect(a.aviso).toMatch(/otro/);
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});

describe("ids hostiles", () => {
  const hostiles: [string, string][] = [
    ["..", ".."],
    [".", "."],
    ["jump_misocp", "../fp_dc/tnep_garver6"],
    ["jump_misocp", "tnep_garver6/"],
    ["jump_misocp/tnep_garver6", "x"],
    ["jump_misocp", "a\\b"],
    ["jump_misocp", "%2e%2e"],
    ["%2e%2e", "tnep_garver6"],
    ["jump_misocp", "tnep_garver6\0"],
    ["jump_misocp", ""],
    ["", ""],
  ];
  it.each(hostiles)("caso(%j, %j) es undefined", (motor, sistema) => {
    expect(almacen.caso(motor, sistema, CON_INTERNOS)).toBeUndefined();
  });
});

describe("lectura confinada", () => {
  const caso = () => {
    const c = almacen.caso("jump_misocp", "tnep_garver6", SIN_INTERNOS);
    if (!c) throw new Error("falta el caso de prueba");
    return c;
  };

  it("lee un fichero del caso", () => {
    expect(caso().leer("base.dat")).toMatch(/Sbase/);
  });

  it("devuelve undefined si el fichero no existe", () => {
    expect(caso().leer("no_existe.dat")).toBeUndefined();
  });

  it("no sale de la carpeta con ..", () => {
    expect(caso().leer("../../manifiesto.json")).toBeUndefined();
    expect(caso().leer("../tnep_truncado/base.dat")).toBeUndefined();
    expect(caso().leer("..")).toBeUndefined();
  });

  it("no acepta rutas absolutas, NUL ni cadenas vacias", () => {
    expect(caso().leer(path.join(FIXTURE, "jump_misocp/tnep_garver6/base.dat"))).toBeUndefined();
    expect(caso().leer("base.dat\0.txt")).toBeUndefined();
    expect(caso().leer("")).toBeUndefined();
  });

  it("no sigue un enlace simbolico que sale de la carpeta", () => {
    expect(caso().leer("enlace.dat")).toBeUndefined();
    expect(caso().leer("enlace_dir/secreto.txt")).toBeUndefined();
  });

  it("ruta(clave) devuelve los nombres declarados", () => {
    expect(caso().ruta("base")).toEqual(["base.dat"]);
    expect(caso().ruta("hvdc")).toEqual(["dc.dat"]);
    expect(caso().ruta("inexistente")).toEqual([]);
  });

  it("un .dat truncado se lee tal cual (el lector decide)", () => {
    const c = almacen.caso("jump_misocp", "tnep_truncado", SIN_INTERNOS);
    expect(c?.leer("base.dat")).toBeDefined();
  });
});

describe("almacen ausente o vacio", () => {
  it("un directorio inexistente da un almacen vacio con aviso que nombra la ruta", async () => {
    const ruta = path.join(tmpdir(), `xpand-no-existe-${String(Date.now())}`);
    const a = await abrirAlmacen(ruta);
    expect(a.casos(CON_INTERNOS)).toEqual([]);
    expect(a.aviso).toContain(ruta);
  });

  it("un directorio vacio da un almacen vacio con aviso", async () => {
    const vacio = await mkdtemp(path.join(tmpdir(), "xpand-alm-vacio-"));
    try {
      const a = await abrirAlmacen(vacio);
      expect(a.casos(CON_INTERNOS)).toEqual([]);
      expect(a.aviso).toContain(vacio);
    } finally {
      await rm(vacio, { recursive: true, force: true });
    }
  });
});
