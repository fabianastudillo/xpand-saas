// Pruebas del comparador con xpand con dos servidores falsos (node:http en el puerto 0): sin Julia ni datos de xpand.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diferenciasRed, ejecutar, type OpcionesEjecutar, type Proyeccion } from "./comparar-con-xpand";
import type { ListaBlanca } from "./importador/lista-blanca";

const CODIGO_OK = 0;
const CODIGO_DIFERENCIAS = 1;
const CODIGO_USO = 64;

const LISTA: ListaBlanca = {
  sistemas: [{ sistema: "tnep_ieee24_clasico", datos: "data/casos/misocp_tnep/ieee24_clasico", fuente: "https://doi.org/10.1109/TPWRS.2023.3305431" }],
};
const ARCHIVOS_PUBLICOS = { base: "/checkout/data/casos/misocp_tnep/ieee24_clasico/base.dat" };
const ARCHIVOS_INTERNOS = { base: "/checkout/data/casos/ecuador/sni_2025/base.dat" };
const OPCIONES: OpcionesEjecutar = { listaBlanca: LISTA };

interface RespuestaFalsa {
  estado: number;
  cuerpo: unknown;
}

function red(pdBarra2 = 291, s = 200): unknown {
  return {
    barras: [
      { id: "1", etiqueta: "1", kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05, tipo: 3 },
      { id: "2", etiqueta: "2", nombre: "Barra dos", kv: 0, pd: pdBarra2, qd: 60, vmin: 0.95, vmax: 1.05 },
    ],
    ac_existentes: [{ id: "L1", de: "1", a: "2", r: 0.0026, x: 0.0139, s }],
    ac_candidatos: [{ id: "C1_2_1", de: 1, a: "2", r: 0.0026, x: 0.0139, s: 200, costo: 3, nmax: 5 }],
  };
}

type SistemaFalso = { id: string; archivos?: Record<string, string>; disponible?: boolean } & Record<string, unknown>;

const catalogo = (motores: Record<string, { sistemas: SistemaFalso[] }>) => ({
  motores: Object.entries(motores).map(([id, m]) => ({ id, ...m })),
});

interface Falso {
  url: string;
  cerrar(): Promise<void>;
}

function cerrarServidor(servidor: Server): Promise<void> {
  return new Promise<void>((resolver) => {
    servidor.close(() => {
      resolver();
    });
  });
}

/** Servidor que responde /api/catalogo y /api/red como xpand (o la plataforma) con lo que se le da. */
async function servidorFalso(cat: unknown, redes: Record<string, RespuestaFalsa>): Promise<Falso> {
  const servidor: Server = createServer((peticion: IncomingMessage, respuesta: ServerResponse) => {
    const url = new URL(peticion.url ?? "/", "http://127.0.0.1");
    const enviar = (estado: number, cuerpo: unknown): void => {
      respuesta.writeHead(estado, { "content-type": "application/json" });
      respuesta.end(JSON.stringify(cuerpo));
    };
    if (url.pathname === "/api/catalogo") {
      enviar(200, cat);
    } else if (url.pathname === "/api/red") {
      const clave = `${url.searchParams.get("motor") ?? ""}/${url.searchParams.get("sistema") ?? ""}`;
      const r = redes[clave];
      if (r) enviar(r.estado, r.cuerpo);
      else enviar(404, { error: { codigo: "caso_no_encontrado", mensaje: "No existe el caso pedido." } });
    } else {
      enviar(404, { error: { codigo: "ruta_no_encontrada", mensaje: "no" } });
    }
  });
  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const direccion = servidor.address();
  if (typeof direccion !== "object" || direccion === null) throw new Error("sin puerto");
  return {
    url: `http://127.0.0.1:${String(direccion.port)}`,
    cerrar: () => cerrarServidor(servidor),
  };
}

const ok = (cuerpo: unknown): RespuestaFalsa => ({ estado: 200, cuerpo });

let tmp: string;
let servidores: Falso[];

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "comparar-xpand-"));
  servidores = [];
});

afterEach(async () => {
  for (const s of servidores) await s.cerrar();
  rmSync(tmp, { recursive: true, force: true });
});

async function arrancar(cat: unknown, redes: Record<string, RespuestaFalsa>): Promise<Falso> {
  const s = await servidorFalso(cat, redes);
  servidores.push(s);
  return s;
}

/** xpand con un caso público y uno interno; la plataforma sirve el público (y, si se pide, el interno). */
async function dosServidores(redXpand: unknown, redPlataforma: unknown, servirInterno = false) {
  const xpand = await arrancar(
    catalogo({
      jump_misocp: {
        sistemas: [
          { id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS },
          { id: "tnep_secreto", archivos: ARCHIVOS_INTERNOS },
        ],
      },
    }),
    {
      "jump_misocp/tnep_ieee24_clasico": ok(redXpand),
      "jump_misocp/tnep_secreto": ok(red(291)),
    },
  );
  const sistemasPlataforma = [{ id: "tnep_ieee24_clasico" }, ...(servirInterno ? [{ id: "tnep_secreto" }] : [])];
  const plataforma = await arrancar(catalogo({ jump_misocp: { sistemas: sistemasPlataforma } }), {
    "jump_misocp/tnep_ieee24_clasico": ok(redPlataforma),
    "jump_misocp/tnep_secreto": ok(red(999)),
  });
  return { xpand, plataforma };
}

const argv = (xpand: Falso, plataforma: Falso, extra: string[] = []) => [
  "--xpand-url",
  xpand.url,
  "--plataforma-url",
  plataforma.url,
  ...extra,
];

describe("comparar-con-xpand: contrato del comparador", () => {
  it("devuelve 0 cuando la red de la plataforma es igual a la de xpand", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_OK);
    expect(salida.texto).toContain("Casos comparados: 1");
    expect(salida.texto).toContain("Diferencias: 0");
  });

  it("devuelve 1 y nombra motor, sistema, ruta y ambos valores ante una cifra distinta en barras[1].pd", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(291), red(290));

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_ieee24_clasico barras[1].pd: xpand=291 plataforma=290");
  });

  it("distingue 220.00000000000003 de 220 (exactitud, no tolerancia)", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(291, 220.00000000000003), red(291, 220));

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("ac_existentes[0].s: xpand=220.00000000000003 plataforma=220");
  });

  it("reporta como diferencia un caso público de la lista que la plataforma no sirve", async () => {
    // Arrange
    const xpand = await arrancar(
      catalogo({ jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS }] } }),
      { "jump_misocp/tnep_ieee24_clasico": ok(red()) },
    );
    const plataforma = await arrancar(catalogo({ jump_misocp: { sistemas: [] } }), {});

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_ieee24_clasico");
    expect(salida.texto).toContain("caso_no_encontrado");
  });

  it("no compara ni nombra un caso interno que solo existe en xpand", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_OK);
    expect(salida.texto).not.toContain("tnep_secreto");
    expect(salida.texto).not.toContain("ecuador");
  });

  it("con --guardar-esperado escribe solo los casos públicos que sirve la plataforma", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());
    const destino = path.join(tmp, "esperado");

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--guardar-esperado", destino]), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_OK);
    const fichero = path.join(destino, "jump_misocp", "tnep_ieee24_clasico", "esperado-red.json");
    expect(existsSync(fichero)).toBe(true);
    expect(existsSync(path.join(destino, "jump_misocp", "tnep_secreto"))).toBe(false);
    const escrito = JSON.parse(readFileSync(fichero, "utf8")) as { barras: { id: unknown }[] };
    expect(escrito.barras.map((b) => b.id)).toEqual(["1", "2"]);
  });

  it("nombra un campo del contrato que solo tiene una de las dos redes", async () => {
    // Arrange: la plataforma no trae el nombre de la barra 2 (campo opcional del contrato).
    const sinNombre = red() as { barras: Record<string, unknown>[] };
    delete sinNombre.barras[1]?.nombre;
    const { xpand, plataforma } = await dosServidores(red(), sinNombre);

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("barras[1].nombre: xpand=\"Barra dos\" plataforma=(ausente)");
  });

  it("trata un error 500 de un caso como diferencia, no como caída del comparador", async () => {
    // Arrange
    const xpand = await arrancar(
      catalogo({ jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS }] } }),
      { "jump_misocp/tnep_ieee24_clasico": { estado: 500, cuerpo: { error: { codigo: "error_interno", mensaje: "x" } } } },
    );
    const plataforma = await arrancar(
      catalogo({ jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico" }] } }),
      { "jump_misocp/tnep_ieee24_clasico": ok(red()) },
    );

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("error_interno");
  });

  it("devuelve 64 cuando un servidor no responde", async () => {
    // Arrange
    const plataforma = await arrancar(catalogo({}), {});
    const cerrado = await arrancar(catalogo({}), {});
    await cerrado.cerrar();
    servidores.splice(servidores.indexOf(cerrado), 1);

    // Act
    const salida = await ejecutar(argv(cerrado, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
  });

  it("devuelve 64 con un uso incorrecto (falta --plataforma-url)", async () => {
    // Arrange
    const xpand = await arrancar(catalogo({}), {});

    // Act
    const salida = await ejecutar(["--xpand-url", xpand.url], OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
    expect(salida.texto).toContain("--plataforma-url");
  });
});

/** Fila pública del catálogo de un IEEE-24 clásico: lo que la plataforma enseña de él (nombre, barras, referencias). */
function filaIeee24(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: "IEEE 24 barras clásico",
    barras: 24,
    referencias: [
      { tecnologias: "ac", valor: 86, fuente: "https://doi.org/10.1109/TPWRS.2023.3305431" },
      { tecnologias: "ac+caps", valor: 59.8 },
    ],
    ...cambios,
  };
}

/** xpand y plataforma con el mismo caso público y la misma red; solo cambia la fila del catálogo de cada lado. */
async function servidoresConFilas(filaXpand: Record<string, unknown>, filaPlataforma: Record<string, unknown> | undefined) {
  const xpand = await arrancar(
    catalogo({
      jump_misocp: {
        sistemas: [
          { id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS, ...filaXpand },
          { id: "tnep_secreto", archivos: ARCHIVOS_INTERNOS, nombre: "Sistema secreto", barras: 999 },
        ],
      },
    }),
    { "jump_misocp/tnep_ieee24_clasico": ok(red()) },
  );
  const sistemasPlataforma = filaPlataforma === undefined ? [] : [{ id: "tnep_ieee24_clasico", ...filaPlataforma }];
  const plataforma = await arrancar(catalogo({ jump_misocp: { sistemas: sistemasPlataforma } }), {
    "jump_misocp/tnep_ieee24_clasico": ok(red()),
  });
  return { xpand, plataforma };
}

describe("comparar-con-xpand: la fila pública del catálogo", () => {
  it("devuelve 0 con la misma fila; «fuente» no se compara (el importador la sustituye)", async () => {
    // Arrange
    const plataforma = filaIeee24({
      referencias: [
        { tecnologias: "ac", valor: 86, fuente: "otra fuente" },
        { tecnologias: "ac+caps", valor: 59.8 },
      ],
    });
    const servidores = await servidoresConFilas(filaIeee24(), plataforma);

    // Act
    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_OK);
    expect(salida.texto).toContain("Diferencias: 0");
  });

  it("nombra un nombre distinto con ambos valores", async () => {
    const servidores = await servidoresConFilas(filaIeee24(), filaIeee24({ nombre: "IEEE-24" }));

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain('jump_misocp/tnep_ieee24_clasico catalogo.nombre: xpand="IEEE 24 barras clásico" plataforma="IEEE-24"');
  });

  it("nombra un número de barras distinto", async () => {
    const servidores = await servidoresConFilas(filaIeee24(), filaIeee24({ barras: 23 }));

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("catalogo.barras: xpand=24 plataforma=23");
  });

  it("compara el valor de referencia con igualdad exacta", async () => {
    const plataforma = filaIeee24({ referencias: [{ tecnologias: "ac", valor: 86.00000000000001 }, { tecnologias: "ac+caps", valor: 59.8 }] });
    const servidores = await servidoresConFilas(filaIeee24(), plataforma);

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("catalogo.referencias[0].valor: xpand=86 plataforma=86.00000000000001");
  });

  it("nombra las tecnologías de una referencia y una referencia que falta", async () => {
    const plataforma = filaIeee24({ referencias: [{ tecnologias: "ac+bancos", valor: 86 }] });
    const servidores = await servidoresConFilas(filaIeee24(), plataforma);

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain('catalogo.referencias[0].tecnologias: xpand="ac" plataforma="ac+bancos"');
    expect(salida.texto).toContain("catalogo.referencias[1]: xpand=presente plataforma=(ausente)");
  });

  it("una referencia sin valor numérico queda fuera, como en el importador y el servidor (contrato: valor exigido)", async () => {
    const xpand = filaIeee24({ referencias: [{ tecnologias: "ac", valor: 86 }, { tecnologias: "ac+caps", valor: "n/d" }] });
    const servidores = await servidoresConFilas(xpand, filaIeee24({ referencias: [{ tecnologias: "ac", valor: 86 }] }));

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_OK);
  });

  it("un caso público que falta en el catálogo de la plataforma se nombra; nada del interno sale", async () => {
    const servidores = await servidoresConFilas(filaIeee24(), undefined);

    const salida = await ejecutar(argv(servidores.xpand, servidores.plataforma), OPCIONES);

    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_ieee24_clasico catalogo: xpand=presente plataforma=(ausente)");
    expect(salida.texto).not.toContain("secreto");
    expect(salida.texto).not.toContain("999");
  });
});

describe("comparar-con-xpand: no da por bueno lo que no ha comparado", () => {
  it("con cero casos públicos que comparar devuelve 1 y lo dice", async () => {
    // Arrange: xpand solo tiene un interno y la plataforma no sirve nada.
    const xpand = await arrancar(catalogo({ jump_misocp: { sistemas: [{ id: "tnep_secreto", archivos: ARCHIVOS_INTERNOS }] } }), {});
    const plataforma = await arrancar(catalogo({ jump_misocp: { sistemas: [] } }), {});

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("ningún caso público que comparar");
    expect(salida.texto).toContain("Casos comparados: 0");
  });

  it("un caso que la plataforma sirve y no está en el conjunto público se nombra por id, sin valores, y no se escribe", async () => {
    // Arrange: la plataforma sirve un interno (pd 999) que xpand tiene fuera de la lista; hay un público correcto.
    const { xpand, plataforma } = await dosServidores(red(), red(), true);
    const destino = path.join(tmp, "esperado");

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--guardar-esperado", destino]), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_secreto");
    expect(salida.texto).toContain("fuera del conjunto público");
    expect(salida.texto).not.toContain("999");
    expect(existsSync(path.join(destino, "jump_misocp", "tnep_secreto"))).toBe(false);
    expect(salida.texto).toContain("Casos comparados: 1");
  });
});

describe("comparar-con-xpand: --publicos", () => {
  const escribirLista = (contenido: unknown, nombre = "publicos.json"): string => {
    const fichero = path.join(tmp, nombre);
    writeFileSync(fichero, JSON.stringify(contenido));
    return fichero;
  };

  it("solo compara los casos del fichero --publicos", async () => {
    // Arrange: el fichero no lista el caso público de xpand, así que no se compara nada.
    const { xpand, plataforma } = await dosServidores(red(), red());
    const lista = escribirLista({ sistemas: [{ sistema: "otro", datos: "data/casos/misocp_tnep/otro", fuente: "https://ejemplo.org/otro" }] });

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--publicos", lista]));

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("ningún caso público que comparar");
  });

  it("una entrada con «motores» solo cuenta en esos motores: en los demás el caso no es público", async () => {
    // Arrange: xpand tiene el mismo caso público en dos motores; la lista solo lo aprueba en uno.
    const xpand = await arrancar(
      catalogo({
        jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS }] },
        fp_dc: { sistemas: [{ id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS }] },
      }),
      { "jump_misocp/tnep_ieee24_clasico": ok(red()), "fp_dc/tnep_ieee24_clasico": ok(red()) },
    );
    const plataforma = await arrancar(
      catalogo({
        jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico" }] },
        fp_dc: { sistemas: [{ id: "tnep_ieee24_clasico" }] },
      }),
      { "jump_misocp/tnep_ieee24_clasico": ok(red()), "fp_dc/tnep_ieee24_clasico": ok(red(999)) },
    );
    const lista = escribirLista({
      sistemas: [{ sistema: "tnep_ieee24_clasico", datos: "data/casos/misocp_tnep/ieee24_clasico", fuente: "https://ejemplo.org/x", motores: ["jump_misocp"] }],
    });

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--publicos", lista]));

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("Casos comparados: 1");
    expect(salida.texto).toContain("fp_dc/tnep_ieee24_clasico (caso): xpand=(fuera del conjunto público)");
    expect(salida.texto).not.toContain("999");
  });

  it("una lista con «motores» que no es una lista de ids se rechaza", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());
    const lista = escribirLista({
      sistemas: [{ sistema: "tnep_ieee24_clasico", datos: "data/casos/misocp_tnep/ieee24_clasico", fuente: "https://ejemplo.org/x", motores: "jump" }],
    });

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--publicos", lista]));

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
  });

  it("rechaza una fuente sin DOI o URL, salvo con --publicos-de-prueba", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());
    const lista = escribirLista({
      sistemas: [{ sistema: "tnep_ieee24_clasico", datos: "data/casos/misocp_tnep/ieee24_clasico", fuente: "Garver (1970), sin enlace" }],
    });

    // Act
    const estricta = await ejecutar(argv(xpand, plataforma, ["--publicos", lista]));
    const deuda = await ejecutar(argv(xpand, plataforma, ["--publicos", lista, "--publicos-de-prueba"]));

    // Assert
    expect(estricta.codigo).toBe(CODIGO_USO);
    expect(estricta.texto).toContain("DOI o URL");
    expect(deuda.codigo).toBe(CODIGO_OK);
  });

  it("--publicos-de-prueba sin --publicos es un uso incorrecto", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());

    // Act
    const salida = await ejecutar(argv(xpand, plataforma, ["--publicos-de-prueba"]), OPCIONES);

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
    expect(salida.texto).toContain("--publicos");
  });
});

describe("diferenciasRed: igualdad exacta y emparejamiento por id", () => {
  const proyeccion = (partes: Partial<Proyeccion>): Proyeccion => ({ barras: [], ac_existentes: [], ac_candidatos: [], ...partes });

  it("0 y -0 son distintos", () => {
    // Arrange
    const xpand = proyeccion({ barras: [{ id: "1", pd: 0 }] });
    const plataforma = proyeccion({ barras: [{ id: "1", pd: -0 }] });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toEqual([{ ruta: "barras[0].pd", xpand: "0", plataforma: "-0" }]);
  });

  it("0.1 + 0.2 no es 0.3", () => {
    // Arrange
    const xpand = proyeccion({ barras: [{ id: "1", pd: 0.1 + 0.2 }] });
    const plataforma = proyeccion({ barras: [{ id: "1", pd: 0.3 }] });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]?.ruta).toBe("barras[0].pd");
  });

  it("una barra que falta en la plataforma se nombra por id y no desplaza al resto", () => {
    // Arrange
    const xpand = proyeccion({ barras: [{ id: "1", pd: 1 }, { id: "2", pd: 2 }, { id: "3", pd: 3 }] });
    const plataforma = proyeccion({ barras: [{ id: "1", pd: 1 }, { id: "3", pd: 3 }] });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toEqual([{ ruta: "barras[id=2]", xpand: "presente", plataforma: "(ausente)" }]);
  });

  it("una barra extra en la plataforma se nombra por id", () => {
    // Arrange
    const xpand = proyeccion({ barras: [{ id: "1", pd: 1 }] });
    const plataforma = proyeccion({ barras: [{ id: "1", pd: 1 }, { id: "9", pd: 9 }] });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toEqual([{ ruta: "barras[id=9]", xpand: "(ausente)", plataforma: "presente" }]);
  });

  it("el mismo contenido en otro orden da una sola línea de orden", () => {
    // Arrange
    const xpand = proyeccion({ barras: [{ id: "1", pd: 1 }, { id: "2", pd: 2 }] });
    const plataforma = proyeccion({ barras: [{ id: "2", pd: 2 }, { id: "1", pd: 1 }] });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toEqual([{ ruta: "barras (orden)", xpand: "orden de xpand", plataforma: "orden distinto" }]);
  });

  it("con ids repetidos empareja por de, a y ocurrencia", () => {
    // Arrange
    const xpand = proyeccion({
      ac_candidatos: [
        { id: "C", de: "1", a: "2", costo: 1 },
        { id: "C", de: "1", a: "3", costo: 2 },
      ],
    });
    const plataforma = proyeccion({
      ac_candidatos: [
        { id: "C", de: "1", a: "2", costo: 1 },
        { id: "C", de: "1", a: "3", costo: 5 },
      ],
    });

    // Act
    const hallazgos = diferenciasRed(xpand, plataforma);

    // Assert
    expect(hallazgos).toEqual([{ ruta: "ac_candidatos[1].costo", xpand: "2", plataforma: "5" }]);
  });

  it("dos redes iguales no tienen diferencias", () => {
    // Arrange
    const red1 = proyeccion({ barras: [{ id: "1", pd: 1, nombre: "a" }], ac_existentes: [{ id: "L", de: "1", a: "2", r: 0.1 }] });

    // Act
    const hallazgos = diferenciasRed(red1, structuredClone(red1));

    // Assert
    expect(hallazgos).toStrictEqual([]);
  });
});
