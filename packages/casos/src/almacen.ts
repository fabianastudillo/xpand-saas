// Almacen de casos en disco: <almacen>/<motor>/<sistema>/manifiesto.json + ficheros fuente.
// Solo Node. Garantias: los ids que llegan de fuera se validan antes de tocar el disco, y toda lectura queda
// confinada a la carpeta del caso (realpath del fichero contra el de la carpeta, asi que ni «..» ni enlaces
// simbolicos sacan de ella).
import Ajv from "ajv";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { Leer } from "@xpand/core";
import manifiestoSchema from "../../../contracts/almacen/manifiesto.schema.json";

export type Visibilidad = "publico" | "interno";

export interface Manifiesto {
  motor: { id: string; nombre: string; formulacion?: string; familia?: string; esquema_red: string; [extra: string]: unknown };
  sistema: {
    id: string;
    nombre: string;
    barras: number;
    dificultad?: string;
    nota?: string;
    referencias?: unknown[];
    [extra: string]: unknown;
  };
  archivos: Record<string, string | string[]>;
  visibilidad: Visibilidad;
  origen: { repo: string; commit: string; ruta: string };
}

export interface Caso {
  readonly manifiesto: Manifiesto;
  /** Lee un fichero del caso por su nombre relativo; undefined si no existe o cae fuera de la carpeta del caso. */
  readonly leer: Leer;
  /** Nombres relativos declarados en `archivos[clave]` (lista vacia si la clave no existe). */
  ruta(clave: string): string[];
}

export interface OpcionesCaso {
  incluirInternos: boolean;
}

export interface Almacen {
  /** Problemas al abrir (almacen ausente o vacio, casos descartados); undefined si todo fue bien. */
  readonly aviso?: string;
  casos(opts: OpcionesCaso): Caso[];
  caso(motor: string, sistema: string, opts: OpcionesCaso): Caso | undefined;
}

const NOMBRE_MANIFIESTO = "manifiesto.json";
const PATRON_ID = /^[A-Za-z0-9_.-]+$/;

const ajv = new Ajv({ strict: true, strictRequired: false, allowUnionTypes: true, allErrors: false });
const validarManifiesto = ajv.compile(manifiestoSchema);

export function esIdValido(id: string): boolean {
  return typeof id === "string" && id !== "." && id !== ".." && PATRON_ID.test(id);
}

function dentroDe(raizReal: string, destino: string): boolean {
  return destino.startsWith(raizReal + path.sep);
}

/** Lector confinado a `dir` (ya resuelto con realpath). Nunca lanza: devuelve undefined ante cualquier problema. */
function lectorConfinado(dirReal: string): Leer {
  return (ruta) => {
    if (typeof ruta !== "string" || ruta === "" || ruta.includes("\0") || path.isAbsolute(ruta)) return undefined;
    try {
      const real = realpathSync(path.resolve(dirReal, ruta));
      if (!dentroDe(dirReal, real) || !statSync(real).isFile()) return undefined;
      return readFileSync(real, "utf8");
    } catch {
      return undefined;
    }
  };
}

function subdirectorios(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

function cargarCaso(raizReal: string, motorId: string, sistemaId: string): { caso?: Caso; problema?: string } {
  const etiqueta = `${motorId}/${sistemaId}`;
  let dirReal: string;
  try {
    dirReal = realpathSync(path.join(raizReal, motorId, sistemaId));
  } catch {
    return { problema: `${etiqueta}: carpeta ilegible` };
  }
  if (!dentroDe(raizReal, dirReal)) return { problema: `${etiqueta}: la carpeta sale del almacen` };
  const leer = lectorConfinado(dirReal);
  const texto = leer(NOMBRE_MANIFIESTO);
  if (texto === undefined) return { problema: `${etiqueta}: falta ${NOMBRE_MANIFIESTO}` };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { problema: `${etiqueta}: ${NOMBRE_MANIFIESTO} no es JSON valido` };
  }
  if (!validarManifiesto(json)) {
    return { problema: `${etiqueta}: manifiesto invalido (${ajv.errorsText(validarManifiesto.errors)})` };
  }
  const manifiesto = json as unknown as Manifiesto;
  if (manifiesto.motor.id !== motorId || manifiesto.sistema.id !== sistemaId) {
    return { problema: `${etiqueta}: los ids del manifiesto no coinciden con las carpetas` };
  }
  const caso: Caso = {
    manifiesto,
    leer,
    ruta(clave) {
      const v = Object.hasOwn(manifiesto.archivos, clave) ? manifiesto.archivos[clave] : undefined;
      return v === undefined ? [] : Array.isArray(v) ? [...v] : [v];
    },
  };
  return { caso };
}

export function abrirAlmacen(dir: string): Promise<Almacen> {
  return Promise.resolve(abrirSincrono(dir));
}

function abrirSincrono(dir: string): Almacen {
  const vacio = (aviso: string): Almacen => ({ aviso, casos: () => [], caso: () => undefined });
  let raizReal: string;
  try {
    raizReal = realpathSync(dir);
    if (!statSync(raizReal).isDirectory()) return vacio(`El almacen ${dir} no es un directorio.`);
  } catch {
    return vacio(`No existe el almacen de casos ${dir}.`);
  }

  const porClave = new Map<string, Caso>();
  const problemas: string[] = [];
  try {
    for (const motorId of subdirectorios(raizReal)) {
      if (!esIdValido(motorId)) {
        problemas.push(`${motorId}: id de motor no valido`);
        continue;
      }
      let sistemas: string[];
      try {
        sistemas = subdirectorios(path.join(raizReal, motorId));
      } catch {
        problemas.push(`${motorId}: carpeta ilegible`);
        continue;
      }
      for (const sistemaId of sistemas) {
        if (!esIdValido(sistemaId)) {
          problemas.push(`${motorId}/${sistemaId}: id de sistema no valido`);
          continue;
        }
        const { caso, problema } = cargarCaso(raizReal, motorId, sistemaId);
        if (caso) porClave.set(`${motorId}\0${sistemaId}`, caso);
        else if (problema) problemas.push(problema);
      }
    }
  } catch {
    return vacio(`No se pudo leer el almacen de casos ${dir}.`);
  }

  if (porClave.size === 0) problemas.unshift(`El almacen ${dir} no tiene casos; importe los casos publicos para poblarlo.`);
  const aviso = problemas.length > 0 ? problemas.join("\n") : undefined;
  const visible = (c: Caso, o: OpcionesCaso) => o.incluirInternos || c.manifiesto.visibilidad === "publico";

  const almacen: Almacen = {
    casos: (opts) => [...porClave.values()].filter((c) => visible(c, opts)),
    caso(motor, sistema, opts) {
      if (!esIdValido(motor) || !esIdValido(sistema)) return undefined;
      const c = porClave.get(`${motor}\0${sistema}`);
      return c && visible(c, opts) ? c : undefined;
    },
  };
  return aviso === undefined ? almacen : { ...almacen, aviso };
}
