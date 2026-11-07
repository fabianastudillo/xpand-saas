import { cp, mkdtemp, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abrirAlmacen, esIdValido, esNombreArchivoValido, MAX_BYTES_FICHERO, type Almacen } from "./almacen";

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
    expect(almacen.aviso).toBeDefined();
    expect(almacen.detalles.join("\n")).toMatch(/jump_misocp\/tnep_invalido/);
    expect(almacen.casos(CON_INTERNOS).length).toBeGreaterThanOrEqual(3);
  });

  it("descarta un manifiesto cuyas carpetas no coinciden con sus ids", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-ids-"));
    try {
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), path.join(raiz, "fp_dc/otro"), { recursive: true });
      const a = await abrirAlmacen(raiz);
      expect(a.casos(CON_INTERNOS)).toHaveLength(0);
      expect(a.detalles.join("\n")).toMatch(/otro/);
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

  it("un .dat truncado se lee tal cual (el lector decide)", async () => {
    const original = await readFile(path.join(FIXTURE, "jump_misocp/tnep_truncado/base.dat"), "utf8");
    const completo = await readFile(path.join(FIXTURE, "jump_misocp/tnep_garver6/base.dat"), "utf8");
    const leido = almacen.caso("jump_misocp", "tnep_truncado", SIN_INTERNOS)?.leer("base.dat");
    expect(leido).toBe(original);
    expect(leido?.length).toBeLessThan(completo.length);
    expect(completo.startsWith(leido ?? "\0")).toBe(true);
  });
});

describe("almacen ausente o vacio", () => {
  it("un directorio inexistente da un almacen vacio con aviso que nombra la ruta", async () => {
    const ruta = path.join(tmpdir(), `xpand-no-existe-${String(Date.now())}`);
    const a = await abrirAlmacen(ruta);
    expect(a.casos(CON_INTERNOS)).toEqual([]);
    expect(a.aviso).toBeDefined();
    expect(a.aviso).not.toContain(ruta);
    expect(a.detalles.join("\n")).toContain(ruta);
  });

  it("un directorio vacio da un almacen vacio con aviso", async () => {
    const vacio = await mkdtemp(path.join(tmpdir(), "xpand-alm-vacio-"));
    try {
      const a = await abrirAlmacen(vacio);
      expect(a.casos(CON_INTERNOS)).toEqual([]);
      expect(a.aviso).toBeDefined();
      expect(a.aviso).not.toContain(vacio);
      expect(a.detalles.join("\n")).toContain(vacio);
    } finally {
      await rm(vacio, { recursive: true, force: true });
    }
  });
});

describe("esIdValido y esNombreArchivoValido", () => {
  it.each(["..", ".", "%2e%2e", "a\0b", "a/b", "a\\b", "", "con espacio", "ñ", "a\n"])("esIdValido(%j) es false", (id) => {
    expect(esIdValido(id)).toBe(false);
  });
  it.each(["tnep_garver6", "jump_misocp", "a-b.c_1", "..a"])("esIdValido(%j) es true", (id) => {
    expect(esIdValido(id)).toBe(true);
  });
  it.each(["../x", "a/../b", "/etc/passwd", "a\\b", "a\0b", "", "a//b", "C:x", "./.."])(
    "esNombreArchivoValido(%j) es false", (n) => {
      expect(esNombreArchivoValido(n)).toBe(false);
    });
  it.each(["base.dat", "sub/base.dat"])("esNombreArchivoValido(%j) es true", (n) => {
    expect(esNombreArchivoValido(n)).toBe(true);
  });
});

describe("aviso publico y detalles de administrador", () => {
  it("aviso nunca contiene la ruta del almacen ni ids de casos", () => {
    expect(almacen.aviso).toBeDefined();
    for (const prohibido of [copia, "tnep_invalido", "jump_misocp", "tnep_garver6", "sintetico_interno", "/"]) {
      expect(almacen.aviso).not.toContain(prohibido);
    }
    expect(almacen.detalles.length).toBeGreaterThan(0);
  });

  it("un almacen sano no tiene aviso", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-sano-"));
    try {
      await cp(path.join(FIXTURE, "fp_dc"), path.join(raiz, "fp_dc"), { recursive: true });
      const a = await abrirAlmacen(raiz);
      expect(a.aviso).toBeUndefined();
      expect(a.detalles).toEqual([]);
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});

describe("recargar", () => {
  it("un caso retirado o vuelto interno deja de ser alcanzable", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-recarga-"));
    try {
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), path.join(raiz, "jump_misocp/tnep_garver6"), { recursive: true });
      await cp(path.join(FIXTURE, "fp_dc/tnep_garver6"), path.join(raiz, "fp_dc/tnep_garver6"), { recursive: true });
      const a = await abrirAlmacen(raiz);
      expect(a.casos(SIN_INTERNOS)).toHaveLength(2);

      const man = path.join(raiz, "jump_misocp/tnep_garver6/manifiesto.json");
      const json = JSON.parse(await readFile(man, "utf8")) as { visibilidad: string };
      json.visibilidad = "interno";
      await writeFile(man, JSON.stringify(json));
      await rm(path.join(raiz, "fp_dc"), { recursive: true });
      expect(a.casos(SIN_INTERNOS)).toHaveLength(2); // foto: aun no surte efecto

      await a.recargar();
      expect(a.caso("jump_misocp", "tnep_garver6", SIN_INTERNOS)).toBeUndefined();
      expect(a.caso("fp_dc", "tnep_garver6", CON_INTERNOS)).toBeUndefined();
      expect(a.caso("jump_misocp", "tnep_garver6", CON_INTERNOS)).toBeDefined();
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it("una relectura fallida conserva la foto anterior y lo anota en detalles", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-fallo-"));
    await cp(path.join(FIXTURE, "fp_dc"), path.join(raiz, "fp_dc"), { recursive: true });
    const a = await abrirAlmacen(raiz);
    await rm(raiz, { recursive: true, force: true });
    await a.recargar();
    expect(a.casos(SIN_INTERNOS)).toHaveLength(1);
    expect(a.detalles.join("\n")).toContain(raiz);
    expect(a.aviso).toBeDefined();
    expect(a.aviso).not.toContain(raiz);
  });
});

describe("archivos hostiles en el manifiesto", () => {
  it.each(["../../x", "/etc/passwd", "a\\b", "a\u0000b"])("descarta un manifiesto con archivos.base = %j", async (nombre) => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-arch-"));
    try {
      const dst = path.join(raiz, "jump_misocp/tnep_garver6");
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), dst, { recursive: true });
      const man = path.join(dst, "manifiesto.json");
      const json = JSON.parse(await readFile(man, "utf8")) as { archivos: Record<string, unknown> };
      json.archivos["base"] = nombre;
      await writeFile(man, JSON.stringify(json));
      const a = await abrirAlmacen(raiz);
      expect(a.caso("jump_misocp", "tnep_garver6", CON_INTERNOS)).toBeUndefined();
      expect(a.detalles.join("\n")).toMatch(/archivos\.base/);
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it("descarta un manifiesto sin visibilidad", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-vis-"));
    try {
      const dst = path.join(raiz, "jump_misocp/tnep_garver6");
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), dst, { recursive: true });
      const man = path.join(dst, "manifiesto.json");
      const json = JSON.parse(await readFile(man, "utf8")) as Record<string, unknown>;
      delete json["visibilidad"];
      await writeFile(man, JSON.stringify(json));
      const a = await abrirAlmacen(raiz);
      expect(a.caso("jump_misocp", "tnep_garver6", CON_INTERNOS)).toBeUndefined();
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});

describe("enlaces en la estructura del almacen", () => {
  it("una carpeta de caso enlazada hacia fuera se descarta", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-enl-"));
    try {
      await cp(path.join(FIXTURE, "jump_misocp/tnep_garver6"), path.join(copia, "externo"), { recursive: true });
      await cp(path.join(FIXTURE, "fp_dc"), path.join(raiz, "fp_dc"), { recursive: true });
      await symlink(path.join(copia, "externo"), path.join(raiz, "fp_dc/fugado"));
      const a = await abrirAlmacen(raiz);
      expect(a.caso("fp_dc", "fugado", CON_INTERNOS)).toBeUndefined();
      expect(a.detalles.join("\n")).toContain("fp_dc/fugado");
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it("una carpeta de caso enlazada a otro caso del almacen se descarta (ids distintos)", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-enl2-"));
    try {
      await cp(path.join(FIXTURE, "fp_dc"), path.join(raiz, "fp_dc"), { recursive: true });
      await symlink(path.join(raiz, "fp_dc/tnep_garver6"), path.join(raiz, "fp_dc/alias"));
      const a = await abrirAlmacen(raiz);
      expect(a.caso("fp_dc", "alias", CON_INTERNOS)).toBeUndefined();
      expect(a.caso("fp_dc", "tnep_garver6", CON_INTERNOS)).toBeDefined();
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it("una raiz enlazada se acepta (se resuelve con realpath al abrir)", async () => {
    const enlace = path.join(copia, "raiz-enlazada");
    await symlink(path.join(copia, "almacen"), enlace);
    const a = await abrirAlmacen(enlace);
    expect(a.caso("fp_dc", "tnep_garver6", SIN_INTERNOS)?.leer("base.dat")).toMatch(/Sbase/);
  });
});

describe("lectura robusta", () => {
  it("un fichero mayor que el tope devuelve undefined y deja un detalle", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "xpand-alm-grande-"));
    try {
      const dst = path.join(raiz, "fp_dc/tnep_garver6");
      await cp(path.join(FIXTURE, "fp_dc/tnep_garver6"), dst, { recursive: true });
      await truncate(path.join(dst, "enorme.dat"), 0).catch(() => writeFile(path.join(dst, "enorme.dat"), ""));
      await truncate(path.join(dst, "enorme.dat"), MAX_BYTES_FICHERO + 1);
      const a = await abrirAlmacen(raiz);
      const caso = a.caso("fp_dc", "tnep_garver6", SIN_INTERNOS);
      expect(caso?.leer("enorme.dat")).toBeUndefined();
      expect(caso?.leer("base.dat")).toMatch(/Sbase/);
      expect(a.detalles.join("\n")).toContain("enorme.dat");
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it("un directorio o un fichero especial no se lee como fichero", () => {
    const caso = almacen.caso("jump_misocp", "tnep_garver6", SIN_INTERNOS);
    expect(caso?.leer("enlace_dir")).toBeUndefined();
    expect(caso?.leer(".")).toBeUndefined();
  });

  it("abrirAlmacen rechaza (no lanza) ante una entrada imposible", async () => {
    await expect(abrirAlmacen("a\0b")).resolves.toBeDefined();
  });
});
