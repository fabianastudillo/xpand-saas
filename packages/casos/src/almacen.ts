// Almacen de casos en disco: <almacen>/<motor>/<sistema>/manifiesto.json + ficheros fuente.
// Solo Node. Garantias: los ids que llegan de fuera se validan antes de tocar el disco, y toda lectura queda
// confinada a la carpeta del caso (realpath del fichero contra el de la carpeta, asi que ni «..» ni enlaces
// simbolicos sacan de ella).
import Ajv from "ajv";
import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
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
  /**
   * Resumen generico y apto para publico (sin rutas del disco, ids ni texto de validacion);
   * undefined si todo fue bien. Es lo unico que puede llegar a una respuesta o a «Problemas».
   */
  readonly aviso?: string | undefined;
  /**
   * Motivos completos por caso (rutas, ids, errores de ajv). SOLO para el registro del servidor y el
   * administrador: nunca se serializa en una respuesta.
   */
  readonly detalles: readonly string[];
  casos(opts: OpcionesCaso): Caso[];
  caso(motor: string, sistema: string, opts: OpcionesCaso): Caso | undefined;
  /**
   * Relee los manifiestos del disco y sustituye el listado de una vez. Si la relectura falla (p. ej. el
   * almacen desaparece) se sigue sirviendo la foto anterior, el motivo queda en `detalles` y devuelve false
   * (true si la relectura fue bien). No lanza.
   */
  recargar(): Promise<boolean>;
}

// Los tipos de @types/node los dan por definidos, pero en Windows O_NOFOLLOW y O_NONBLOCK son undefined.
const O_NOFOLLOW = constants.O_NOFOLLOW as number | undefined;
const O_NONBLOCK = constants.O_NONBLOCK as number | undefined;
const NOMBRE_MANIFIESTO = "manifiesto.json";
const PATRON_ID = /^[A-Za-z0-9_.-]+$/;
/** Tope de tamano de un fichero de caso: la lectura es sincrona y bloquea el bucle de eventos. */
export const MAX_BYTES_FICHERO = 64 * 1024 * 1024;
const MAX_DETALLES_LECTURA = 100;

const ajv = new Ajv({ strict: true, strictRequired: false, allowUnionTypes: true, allErrors: false });
const validarManifiesto = ajv.compile<Manifiesto>(manifiestoSchema);

export function esIdValido(id: string): boolean {
  return typeof id === "string" && id !== "." && id !== ".." && PATRON_ID.test(id);
}

/** Un nombre de `archivos` es relativo y simple: sin NUL, barra invertida, raiz ni segmentos `..`/vacios. */
export function esNombreArchivoValido(nombre: string): boolean {
  if (nombre === "" || nombre.includes("\0") || nombre.includes("\\") || nombre.startsWith("/")) return false;
  if (path.isAbsolute(nombre) || /^[A-Za-z]:/.test(nombre)) return false;
  return nombre.split("/").every((seg) => seg !== "" && seg !== "..");
}

function dentroDe(raizReal: string, destino: string): boolean {
  return destino.startsWith(raizReal + path.sep);
}

function congelar<T>(valor: T): T {
  if (valor !== null && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor)) congelar(v);
  }
  return valor;
}

/**
 * Lector confinado a `dirReal` (ya resuelto con realpath). Nunca lanza. El fichero se abre con O_NOFOLLOW y
 * se lee por el descriptor (fstat sobre el fd), de modo que cambiar el fichero por un enlace despues de la
 * comprobacion no sirve para salir.
 */
function lectorConfinado(dirReal: string, registrar: (msg: string) => void): Leer {
  return (ruta) => {
    if (typeof ruta !== "string" || ruta === "" || ruta.includes("\0") || path.isAbsolute(ruta)) return undefined;
    let fd: number | undefined;
    try {
      const real = realpathSync(path.resolve(dirReal, ruta));
      if (!dentroDe(dirReal, real)) return undefined;
      // O_NOFOLLOW no existe en Windows (undefined): alli se comprueba con lstat el ultimo componente antes de abrir
      // (queda una ventana minima, aceptada en esa plataforma). O_NONBLOCK evita que un FIFO bloquee el open.
      if (O_NOFOLLOW === undefined && lstatSync(real).isSymbolicLink()) return undefined;
      fd = openSync(real, constants.O_RDONLY | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0));
      const st = fstatSync(fd);
      if (!st.isFile()) return undefined;
      if (st.size > MAX_BYTES_FICHERO) {
        registrar(`${real}: ${String(st.size)} bytes superan el tope de ${String(MAX_BYTES_FICHERO)}`);
        return undefined;
      }
      return readFileSync(fd, "utf8");
    } catch {
      return undefined;
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  };
}

function subdirectorios(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

function cargarCaso(
  raizReal: string,
  motorId: string,
  sistemaId: string,
  registrar: (msg: string) => void,
): { caso?: Caso; problema?: string } {
  const etiqueta = `${motorId}/${sistemaId}`;
  let dirReal: string;
  try {
    dirReal = realpathSync(path.join(raizReal, motorId, sistemaId));
  } catch {
    return { problema: `${etiqueta}: carpeta ilegible` };
  }
  if (!dentroDe(raizReal, dirReal)) return { problema: `${etiqueta}: la carpeta sale del almacen` };
  const texto = lectorConfinado(dirReal, registrar)(NOMBRE_MANIFIESTO);
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
  if (json.motor.id !== motorId || json.sistema.id !== sistemaId) {
    return { problema: `${etiqueta}: los ids del manifiesto no coinciden con las carpetas` };
  }
  for (const [clave, valor] of Object.entries(json.archivos)) {
    for (const nombre of Array.isArray(valor) ? valor : [valor]) {
      if (!esNombreArchivoValido(nombre)) {
        return { problema: `${etiqueta}: archivos.${clave} tiene un nombre no permitido (${JSON.stringify(nombre)})` };
      }
    }
  }
  const manifiesto = congelar(json);
  const caso: Caso = {
    manifiesto,
    leer: lectorConfinado(dirReal, registrar),
    ruta(clave) {
      const v = Object.hasOwn(manifiesto.archivos, clave) ? manifiesto.archivos[clave] : undefined;
      return v === undefined ? [] : Array.isArray(v) ? [...v] : [v];
    },
  };
  return { caso };
}

interface Foto {
  readonly casos: ReadonlyMap<string, Caso>;
  readonly detalles: readonly string[];
  readonly descartados: number;
}

const FOTO_VACIA: Foto = { casos: new Map(), detalles: [], descartados: 0 };

/** Lee todo el almacen. Lanza si la raiz no se puede resolver o listar; los casos defectuosos se descartan. */
function leerAlmacen(dir: string, registrar: (msg: string) => void): Foto {
  const raizReal = realpathSync(dir);
  if (!statSync(raizReal).isDirectory()) throw new Error(`${dir} no es un directorio`);
  const casos = new Map<string, Caso>();
  const detalles: string[] = [];
  for (const motorId of subdirectorios(raizReal)) {
    if (!esIdValido(motorId)) {
      detalles.push(`${motorId}: id de motor no valido`);
      continue;
    }
    let sistemas: string[];
    try {
      sistemas = subdirectorios(path.join(raizReal, motorId));
    } catch {
      detalles.push(`${motorId}: carpeta ilegible`);
      continue;
    }
    for (const sistemaId of sistemas) {
      if (!esIdValido(sistemaId)) {
        detalles.push(`${motorId}/${sistemaId}: id de sistema no valido`);
        continue;
      }
      const { caso, problema } = cargarCaso(raizReal, motorId, sistemaId, registrar);
      if (caso) casos.set(`${motorId}\0${sistemaId}`, caso);
      else if (problema) detalles.push(problema);
    }
  }
  return { casos, detalles, descartados: detalles.length };
}

const PREFIJO_FALLO = "No se pudo leer el almacen ";

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function crearAlmacen(dir: string): Almacen {
  let foto: Foto = FOTO_VACIA;
  let recargaFallida = false;
  let detallesInicio: readonly string[] = [];
  const lecturas: string[] = [];
  const registrar = (msg: string) => {
    if (lecturas.length < MAX_DETALLES_LECTURA) lecturas.push(msg);
  };

  const cargar = (): boolean => {
    try {
      foto = leerAlmacen(dir, registrar);
      detallesInicio =
        foto.casos.size === 0 ? [`El almacen ${dir} no tiene casos; importe los casos publicos para poblarlo.`, ...foto.detalles] : foto.detalles;
      recargaFallida = false;
      lecturas.length = 0; // los fallos de lectura de la foto anterior ya no aplican
      return true;
    } catch (e) {
      recargaFallida = true;
      // Se sustituye la entrada de fallo anterior (si la hay) para que N relecturas fallidas dejen detalles acotados.
      detallesInicio = [...detallesInicio.filter((d) => !d.startsWith(PREFIJO_FALLO)), `${PREFIJO_FALLO}${dir}: ${mensajeError(e)}`];
      return false;
    }
  };
  cargar();

  const visible = (c: Caso, o: OpcionesCaso) => o.incluirInternos || c.manifiesto.visibilidad === "publico";
  return {
    get aviso() {
      if (foto.casos.size === 0) return "El almacén de casos no existe o está vacío.";
      if (recargaFallida) return "No se pudo actualizar el almacén de casos.";
      // Sin numero: la cuenta incluiria casos internos, que no deben dejarse adivinar.
      if (foto.descartados > 0) return "Algunos casos no se pudieron cargar.";
      return undefined;
    },
    get detalles() {
      return [...detallesInicio, ...lecturas];
    },
    casos: (opts) => [...foto.casos.values()].filter((c) => visible(c, opts)),
    caso(motor, sistema, opts) {
      if (!esIdValido(motor) || !esIdValido(sistema)) return undefined;
      const c = foto.casos.get(`${motor}\0${sistema}`);
      return c && visible(c, opts) ? c : undefined;
    },
    recargar: () => new Promise<boolean>((resolve) => { resolve(cargar()); }),
  };
}

export function abrirAlmacen(dir: string): Promise<Almacen> {
  return new Promise((resolve) => { resolve(crearAlmacen(dir)); });
}
