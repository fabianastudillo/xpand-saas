// Pruebas del comparador con xpand con dos servidores falsos (node:http en el puerto 0): sin Julia ni datos de xpand.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ejecutar, type OpcionesEjecutar } from "./comparar-con-xpand";
import type { ListaBlanca } from "./importador/lista-blanca";

const CODIGO_OK = 0;
const CODIGO_DIFERENCIAS = 1;
const CODIGO_USO = 64;

const LISTA: ListaBlanca = {
  sistemas: [{ sistema: "tnep_ieee24_clasico", datos: "data/casos/misocp_tnep/ieee24_clasico", fuente: "https://doi.org/10.1109/TPWRS.2023.3305431" }],
};
const ARCHIVOS_PUBLICOS = { base: "/checkout/data/casos/misocp_tnep/ieee24_clasico/base.dat" };
const ARCHIVOS_INTERNOS = { base: "/checkout/data/casos/ecuador/sni_2025/base.dat" };

interface RespuestaFalsa {
  estado: number;
  cuerpo: unknown;
}

function red(pdBarra2 = 291): unknown {
  return {
    barras: [
      { id: "1", etiqueta: "1", kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05, tipo: 3 },
      { id: "2", etiqueta: "2", nombre: "Barra dos", kv: 0, pd: pdBarra2, qd: 60, vmin: 0.95, vmax: 1.05 },
    ],
    ac_existentes: [{ id: "L1", de: "1", a: "2", r: 0.0026, x: 0.0139, s: 200 }],
    ac_candidatos: [{ id: "C1_2_1", de: 1, a: "2", r: 0.0026, x: 0.0139, s: 200, costo: 3, nmax: 5 }],
  };
}

const catalogo = (motores: Record<string, { sistemas: { id: string; archivos?: Record<string, string>; disponible?: boolean }[] }>) => ({
  motores: Object.entries(motores).map(([id, m]) => ({ id, ...m })),
});

function cerrarServidor(servidor: Server): Promise<void> {
  return new Promise<void>((resolver) => {
    servidor.close(() => {
      resolver();
    });
  });
}

interface Falso {
  url: string;
  cerrar(): Promise<void>;
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

/** Un par de servidores: xpand con un caso público y uno interno, y la plataforma con el público. */
async function dosServidores(redXpand: unknown, redPlataforma: unknown) {
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
      "jump_misocp/tnep_secreto": ok(red()),
    },
  );
  const plataforma = await arrancar(
    catalogo({ jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico" }] } }),
    { "jump_misocp/tnep_ieee24_clasico": ok(redPlataforma) },
  );
  return { xpand, plataforma };
}

const argv = (xpand: Falso, plataforma: Falso, extra: string[] = []) => [
  "--xpand-url",
  xpand.url,
  "--plataforma-url",
  plataforma.url,
  ...extra,
];
const opciones: OpcionesEjecutar = { listaBlanca: LISTA };

describe("comparar-con-xpand", () => {
  it("devuelve 0 cuando la red de la plataforma es igual a la de xpand", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

    // Assert
    expect(salida.codigo).toBe(CODIGO_OK);
    expect(salida.texto).toContain("Casos comparados: 1");
    expect(salida.texto).toContain("Diferencias: 0");
  });

  it("devuelve 1 y nombra motor, sistema, ruta y ambos valores ante una cifra distinta en barras[1].pd", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(291), red(290));

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_ieee24_clasico barras[1].pd: xpand=291 plataforma=290");
  });

  it("reporta como diferencia un caso público de la lista que la plataforma no sirve", async () => {
    // Arrange
    const xpand = await arrancar(
      catalogo({ jump_misocp: { sistemas: [{ id: "tnep_ieee24_clasico", archivos: ARCHIVOS_PUBLICOS }] } }),
      { "jump_misocp/tnep_ieee24_clasico": ok(red()) },
    );
    const plataforma = await arrancar(catalogo({ jump_misocp: { sistemas: [] } }), {});

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

    // Assert
    expect(salida.codigo).toBe(CODIGO_DIFERENCIAS);
    expect(salida.texto).toContain("jump_misocp/tnep_ieee24_clasico");
    expect(salida.texto).toContain("caso_no_encontrado");
  });

  it("no compara ni nombra un caso interno que solo existe en xpand", async () => {
    // Arrange
    const { xpand, plataforma } = await dosServidores(red(), red());

    // Act
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

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
    const salida = await ejecutar(argv(xpand, plataforma, ["--guardar-esperado", destino]), opciones);

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
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

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
    const salida = await ejecutar(argv(xpand, plataforma), opciones);

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
    const salida = await ejecutar(argv(cerrado, plataforma), opciones);

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
  });

  it("devuelve 64 con un uso incorrecto (falta --plataforma-url)", async () => {
    // Arrange
    const xpand = await arrancar(catalogo({}), {});

    // Act
    const salida = await ejecutar(["--xpand-url", xpand.url], opciones);

    // Assert
    expect(salida.codigo).toBe(CODIGO_USO);
    expect(salida.texto).toContain("--plataforma-url");
  });
});
