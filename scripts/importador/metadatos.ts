// Volcado del catalogo de xpand (scripts/julia/volcar-catalogo.jl) y paso de sus campos a un manifiesto.
//
// Lo que se copia a `motor` y `sistema` llega tal cual a la respuesta anonima de /api/catalogo (apps/web
// construirCatalogo), asi que se copian SOLO las claves de estas listas y con su tipo: nunca `raiz`, `archivos`,
// `extra`, `disponible` ni nada con rutas del disco.
import { esIdValido, type Manifiesto } from "@xpand/casos";

type Dict = Record<string, unknown>;

export interface SistemaVolcado extends Dict {
  readonly archivos?: unknown;
}

export interface MotorVolcado extends Dict {
  readonly sistemas: readonly SistemaVolcado[];
}

export interface Volcado {
  readonly motores: readonly MotorVolcado[];
}

const CAMPOS_MOTOR = ["formulacion", "familia"] as const;
const TEXTOS_SISTEMA = ["dificultad", "nota", "familia", "variante", "fuente", "modelo_datos"] as const;
const TEXTOS_REFERENCIA = ["tecnologias", "formulacion", "fuente"] as const;

const esDict = (v: unknown): v is Dict => v !== null && typeof v === "object" && !Array.isArray(v);
const textoNoVacio = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Lee el JSON del volcado y comprueba su forma (motores con su lista de sistemas). */
export function leerVolcado(texto: string): Volcado {
  const json: unknown = JSON.parse(texto);
  if (!esDict(json) || !Array.isArray(json.motores)) throw new Error("el volcado no tiene un array «motores»");
  for (const m of json.motores as unknown[]) {
    if (!esDict(m) || !Array.isArray(m.sistemas) || !(m.sistemas as unknown[]).every(esDict)) {
      throw new Error("el volcado tiene un motor sin lista de sistemas");
    }
  }
  return json as unknown as Volcado;
}

/** Bloque `motor` del manifiesto, o undefined si al motor le falta algo que el contrato exige. */
export function motorDelManifiesto(m: MotorVolcado): Manifiesto["motor"] | undefined {
  const { id, nombre, esquema_red: esquema } = m;
  if (typeof id !== "string" || !esIdValido(id) || !textoNoVacio(nombre) || !textoNoVacio(esquema)) return undefined;
  const extra: Dict = {};
  for (const k of CAMPOS_MOTOR) if (typeof m[k] === "string") extra[k] = m[k];
  // El contrato del catalogo exige formulacion o familia en cada motor.
  if (Object.keys(extra).length === 0) return undefined;
  return { id, nombre, ...extra, esquema_red: esquema };
}

function referencia(r: unknown): Dict | undefined {
  if (!esDict(r) || typeof r.valor !== "number" || !Number.isFinite(r.valor)) return undefined;
  const out: Dict = {};
  for (const k of TEXTOS_REFERENCIA) if (typeof r[k] === "string") out[k] = r[k];
  out.valor = r.valor;
  if (typeof r.crf === "number" && Number.isFinite(r.crf)) out.crf = r.crf;
  return out;
}

/**
 * Bloque `sistema` del manifiesto, o undefined si falta id, nombre o barras. `fuente` es la del catalogo y, si viene
 * vacia, la de la lista blanca.
 */
export function sistemaDelManifiesto(s: SistemaVolcado, fuenteLista?: string): Manifiesto["sistema"] | undefined {
  const { id, nombre, barras } = s;
  if (typeof id !== "string" || !esIdValido(id) || !textoNoVacio(nombre)) return undefined;
  if (typeof barras !== "number" || !Number.isInteger(barras) || barras < 0) return undefined;
  const out: Manifiesto["sistema"] = { id, nombre, barras };
  for (const k of TEXTOS_SISTEMA) if (typeof s[k] === "string") out[k] = s[k];
  if (!textoNoVacio(out.fuente) && fuenteLista !== undefined) out.fuente = fuenteLista;
  if (Array.isArray(s.tecnologias_datos) && s.tecnologias_datos.every((t) => typeof t === "string")) {
    out.tecnologias_datos = [...s.tecnologias_datos];
  }
  if (Array.isArray(s.referencias)) {
    const refs = (s.referencias as unknown[]).map(referencia).filter((r) => r !== undefined);
    if (refs.length > 0) out.referencias = refs;
  }
  return out;
}

/** `archivos` del volcado como clave -> lista de rutas (se recuerda si era lista), o undefined si no tiene esa forma. */
export function archivosDelVolcado(s: SistemaVolcado): { clave: string; rutas: string[]; lista: boolean }[] | undefined {
  if (!esDict(s.archivos)) return undefined;
  const out: { clave: string; rutas: string[]; lista: boolean }[] = [];
  for (const [clave, v] of Object.entries(s.archivos)) {
    if (typeof v === "string") out.push({ clave, rutas: [v], lista: false });
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out.push({ clave, rutas: [...v], lista: true });
    else return undefined;
  }
  return out;
}

/** Primer fichero que define la red, en el orden de xpand (`base`, luego `m`, luego `red`). */
export function ficheroPrincipal(archivos: readonly { clave: string; rutas: string[] }[]): string | undefined {
  for (const clave of ["base", "m", "red"]) {
    const a = archivos.find((x) => x.clave === clave);
    if (a?.rutas[0] !== undefined) return a.rutas[0];
  }
  return undefined;
}
