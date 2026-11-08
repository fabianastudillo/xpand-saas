// Shared pieces of the Red readers (packages/XpandCore/src/red.jl): the
// conversions `_num`, `_txt` and `_bus`, the paths of the readers, and the
// neutral form of their output (decision D2 of feature 003). The readers are
// pure: every file arrives through a `Leer` callback, so none of them touches
// the file system (Principle III).

/** Reads a file of the case: its text, or undefined when the file does not exist (`isfile`). */
export type Leer = (ruta: string) => string | undefined;

/** A value of the neutral form: the JSON subset, with non-finite numbers labelled (D2). */
export type Json = number | string | boolean | null | Json[] | { [key: string]: Json };
export type Dict = { [key: string]: Json };

/** `_num(x, def)`: x when it is a number, else def. */
export function num(x: unknown, def = 0.0): number {
  return typeof x === "number" ? x : def;
}

/** `_txt(x)`: the text of x, "" for nothing. */
export function txt(x: unknown): string {
  return x === undefined || x === null ? "" : String(x);
}

/** `_bus(x)`: the bus key of x; 3.0 and 3 both give "3". */
export function bus(x: unknown): string {
  if (x === undefined || x === null) return "";
  return String(x);
}

/**
 * Julia's `string(x)` of a value read from a `.dat`: a float that is integral
 * keeps its ".0" (`string(3.0) == "3.0"`), NaN and the infinities keep Julia's words.
 */
export function textoJulia(x: unknown): string {
  if (typeof x === "number") {
    if (Number.isNaN(x)) return "NaN";
    if (x === Infinity) return "Inf";
    if (x === -Infinity) return "-Inf";
    return Number.isInteger(x) ? `${x}.0` : String(x);
  }
  return txt(x);
}

/** Julia's `strip(s, chars)`: removes the characters of `chars` from both ends. */
export function stripChars(s: string, chars: string): string {
  let i = 0;
  let j = s.length;
  while (i < j && chars.includes(s[i]!)) i++;
  while (j > i && chars.includes(s[j - 1]!)) j--;
  return s.slice(i, j);
}

/** Julia's `dirname` for the `/`-separated paths of the readers. */
export function dirname(ruta: string): string {
  const i = ruta.lastIndexOf("/");
  if (i === -1) return "";
  return i === 0 ? "/" : ruta.slice(0, i);
}

/** Julia's `joinpath` for the same paths. */
export function joinpath(dir: string, nombre: string): string {
  if (dir === "") return nombre;
  return dir.endsWith("/") ? dir + nombre : `${dir}/${nombre}`;
}

/** The lines of a text as `eachline` yields them: no line break, and a CR before it is dropped. */
export function lineas(texto: string): string[] {
  const partes = texto.split("\n");
  if (partes[partes.length - 1] === "") partes.pop();
  return partes.map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
}

/**
 * Julia's `Int(round(x))`: ties to even, and an error for a non-finite value
 * (Julia throws an InexactError there).
 */
export function enteroRedondeado(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`cannot convert ${x} to an integer`);
  const floor = Math.floor(x);
  const diff = x - floor;
  let r: number;
  if (diff < 0.5) r = floor;
  else if (diff > 0.5) r = floor + 1;
  else r = floor % 2 === 0 ? floor : floor + 1;
  return r === 0 ? 0 : r;
}

/** `Int(x)` of a token that Julia parses as an integer (`parse(Int, s)`): an error otherwise. */
export function enteroDeToken(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) throw new RangeError(`invalid integer token "${s}"`);
  const n = Number(s);
  return n === 0 ? 0 : n;
}

/**
 * The neutral form of a built value (D2): NaN and the infinities become the
 * labelled objects `{"nonfinite": ...}`, and a Map or a Set becomes the
 * ascending list or the object that the serializer of Julia writes for it.
 */
export function neutro(valor: unknown): Json {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "number") {
    if (Number.isNaN(valor)) return { nonfinite: "NaN" };
    if (valor === Infinity) return { nonfinite: "Inf" };
    if (valor === -Infinity) return { nonfinite: "-Inf" };
    return valor;
  }
  if (typeof valor === "string" || typeof valor === "boolean") return valor;
  if (valor instanceof Set) return [...valor].map(neutro).sort(compararNeutros);
  if (valor instanceof Map) {
    return Object.fromEntries([...valor].map(([k, v]) => [String(k), neutro(v)]));
  }
  if (Array.isArray(valor)) return valor.map(neutro);
  const out: Dict = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) out[k] = neutro(v);
  return out;
}

// Ascending order of the elements of a Set (strings), as the fixtures write them.
function compararNeutros(a: Json, b: Json): number {
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
