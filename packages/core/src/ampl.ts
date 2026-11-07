// Reader for AMPL `.dat` data files: the TypeScript port of
// packages/XpandCore/src/ampldat.jl. It works on text only (no file system and
// no environment), and it returns the neutral form used by the shared fixtures
// (specs/002-port-lectores-ts/contracts/neutral-format.md).
//
// Like the Julia reader, it covers the forms that appear in this repository and
// never throws on an unknown form: the statement is kept verbatim in `raw`.

import { parseDecimal } from "./numeric";

export type AmplValue = number | string;

export interface AmplParam {
  key: string[];
  value: AmplValue;
}

/**
 * Neutral form of a read `.dat` (contracts/neutral-format.md of 002). A scalar
 * whose value is "." is `null` (decision D2 of 003, as `nothing` in Julia).
 */
export interface AmplData {
  raw: string[];
  scalars: Record<string, AmplValue | null>;
  sets: Record<string, string[][]>;
  params: Record<string, AmplParam[]>;
}

/**
 * The `Datos` of ampldat.jl: the merged content of one or more `.dat` texts.
 * A scalar whose value is "." is stored as `null`, as Julia stores `nothing`.
 */
export interface Datos {
  raw: string[];
  scalars: Map<string, AmplValue | null>;
  sets: Map<string, string[][]>;
  params: Map<string, Map<string, AmplParam>>;
}

// Column-index pairs of a row, such as `[8,2,5,2] 0.5`.
const BRACKET_PAIR = /\[([^\]]*)\]\s*([^\s[\]]+)/g;

// A set element: a parenthesized tuple `(a,b,c)` or a plain token.
const SET_ELEMENT = /\(([^)]*)\)|([^\s(),]+)/g;

function parseValue(token: string): AmplValue | undefined {
  // "." is AMPL's marker for "no data": nothing is stored for it.
  if (token === ".") return undefined;
  return parseDecimal(token) ?? token;
}

function tokens(text: string): string[] {
  return text.split(/[\s,]+/).filter((token) => token !== "");
}

// Drops each `#` comment from its `#` to the end of the line.
function stripComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const hash = line.indexOf("#");
      return hash === -1 ? line : line.slice(0, hash);
    })
    .join("\n");
}

// Non-empty rows of a table body, each one tokenized.
function rows(body: string): string[][] {
  return body
    .split("\n")
    .map(tokens)
    .filter((row) => row.length > 0);
}

function setElements(body: string): string[][] {
  const elements: string[][] = [];
  for (const match of body.matchAll(SET_ELEMENT)) {
    elements.push(match[1] !== undefined ? tokens(match[1]) : [match[2]!]);
  }
  return elements;
}

function keyId(key: readonly string[]): string {
  return JSON.stringify(key);
}

function storeParam(d: Datos, name: string, key: string[], value: AmplValue | undefined): void {
  if (value === undefined) return;
  let table = d.params.get(name);
  if (table === undefined) {
    table = new Map();
    d.params.set(name, table);
  }
  table.set(keyId(key), { key, value });
}

// Declares an index set: keeps the existing elements and appends the new ones
// that are not yet there, in order.
function declareSet(d: Datos, name: string, keys: string[][]): void {
  const existing = d.sets.get(name) ?? [];
  d.sets.set(name, existing);
  const seen = new Set(existing.map(keyId));
  for (const key of keys) {
    const id = keyId(key);
    if (!seen.has(id)) {
      existing.push(key);
      seen.add(id);
    }
  }
}

// `param NAME : c1 c2 := ...` (matrix, the first index is the row) and
// `param NAME := ...` (scalar, indexed by lines, or with brackets).
function parseNamedParam(d: Datos, rest: string[], body: string): void {
  const name = rest[0]!;

  if (rest.length >= 2 && rest[1] === ":") {
    const columns = rest.slice(2);
    for (const row of rows(body)) {
      if (row.length < 2) continue;
      const rowKey = row[0]!;
      for (let c = 0; c < columns.length; c++) {
        if (c + 1 >= row.length) break;
        storeParam(d, name, [rowKey, columns[c]!], parseValue(row[c + 1]!));
      }
    }
    return;
  }

  if (body.includes("[")) {
    for (const match of body.matchAll(BRACKET_PAIR)) {
      storeParam(d, name, tokens(match[1]!), parseValue(match[2]!));
    }
    return;
  }

  const bodyTokens = tokens(body);
  if (bodyTokens.length === 1) {
    d.scalars.set(name, parseValue(bodyTokens[0]!) ?? null);
    return;
  }

  for (const row of rows(body)) {
    if (row.length < 2) continue;
    storeParam(d, name, row.slice(0, -1), parseValue(row[row.length - 1]!));
  }
}

// `param : [SET :] c1 c2 ... := ...`. A second ":" at the third position
// declares the index set named in the middle; otherwise the table is read over
// an index set that is already declared.
function parseTableParam(d: Datos, rest: string[], body: string): void {
  let setName = "";
  let columns: string[];
  if (rest.indexOf(":", 1) === 2) {
    setName = rest[1]!;
    columns = rest.slice(3);
  } else {
    columns = rest.slice(1);
  }
  if (columns.length === 0) return;

  const keys: string[][] = [];
  for (const row of rows(body)) {
    if (row.length <= columns.length) continue;
    const arity = row.length - columns.length;
    const key = row.slice(0, arity);
    keys.push(key);
    columns.forEach((column, c) => {
      storeParam(d, column, key, parseValue(row[arity + c]!));
    });
  }
  if (setName !== "") declareSet(d, setName, keys);
}

function parseStatement(d: Datos, statement: string): void {
  if (statement.trim() === "") return;

  const assign = statement.indexOf(":=");
  if (assign === -1) {
    d.raw.push(statement.trim());
    return;
  }
  const header = statement.slice(0, assign);
  const body = statement.slice(assign + 2);

  const head = tokens(header.replaceAll(":", " : "));
  if (head.length === 0) return;
  const keyword = head[0]!.toLowerCase();

  if (keyword === "set") {
    if (head.length < 2) return;
    // `set HSEC[PUN] := ;` is legitimate and empty: it is registered anyway.
    d.sets.set(head[1]!, setElements(body));
    return;
  }

  if (keyword !== "param") {
    d.raw.push(statement.trim());
    return;
  }

  const rest = head.slice(1);
  if (rest.length === 0) {
    d.raw.push(statement.trim());
    return;
  }

  if (rest[0] !== ":") {
    parseNamedParam(d, rest, body);
  } else {
    parseTableParam(d, rest, body);
  }
}

// Lexicographic order of keys, element by element; a prefix sorts first.
function compareKeys(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return a.length - b.length;
}

function emptyDatos(): Datos {
  return { raw: [], scalars: new Map(), sets: new Map(), params: new Map() };
}

/** Merges one `.dat` text into `d`, in place (`leer_dat`). */
export function leerDat(d: Datos, text: string): Datos {
  for (const statement of stripComments(text).split(";")) {
    parseStatement(d, statement);
  }
  return d;
}

/**
 * Merges `.dat` texts in order (`leer_dats`): a later text overwrites an earlier
 * one, as `data a.dat; data b.dat;` does in AMPL.
 */
export function leerDats(texts: readonly string[]): Datos {
  const d = emptyDatos();
  for (const text of texts) leerDat(d, text);
  return d;
}

/** The elements of a set as key tuples (empty when the set is absent: `valores`). */
export function valores(d: Datos, conjunto: string): string[][] {
  return d.sets.get(conjunto) ?? [];
}

/** The one-dimensional elements of a set, in order (`clave1`). */
export function clave1(d: Datos, conjunto: string): string[] {
  return valores(d, conjunto)
    .filter((key) => key.length === 1)
    .map((key) => key[0]!);
}

export function tiene(d: Datos, conjunto: string): boolean {
  return d.sets.has(conjunto);
}

/**
 * An indexed parameter value (`par`). Undefined when absent (`nothing` in
 * Julia): callers apply their own default, as Julia's `_num` does.
 */
export function par(d: Datos, nombre: string, clave: string | readonly string[]): AmplValue | undefined {
  const key = typeof clave === "string" ? [clave] : [...clave];
  return d.params.get(nombre)?.get(keyId(key))?.value;
}

/** A scalar of the file (`escalar`): null for a "." (Julia `nothing`), undefined when absent. */
export function escalar(d: Datos, nombre: string): AmplValue | null | undefined {
  return d.scalars.get(nombre);
}

/**
 * Reads one `.dat` text, or several texts merged in order, into the neutral
 * form used by the shared fixtures.
 */
export function readAmplDat(sources: string | readonly string[]): AmplData {
  const d = leerDats(typeof sources === "string" ? [sources] : sources);

  const params: Record<string, AmplParam[]> = {};
  for (const [name, table] of d.params) {
    params[name] = [...table.values()].sort((a, b) => compareKeys(a.key, b.key));
  }
  return {
    raw: [...d.raw],
    scalars: Object.fromEntries(d.scalars),
    sets: Object.fromEntries(d.sets),
    params,
  };
}
