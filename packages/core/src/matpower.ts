// Reader for MATPOWER `.m` case files: the TypeScript port of the primitives in
// packages/XpandCore/src/red.jl (`leer_m_filas`, `leer_m_celdas`,
// `_partir_comentario`, `_tokens_m`), plus the named sections `bus`, `gen`,
// `branch` and `gencost` (option B of research R5). It works on text only.
//
// It does not port `red_matpower`, the `mpc.gtnep_*` tables or the `ne_*`
// tables: those belong to the network reader (`Red`), a later step.

import { parseDecimal } from "./numeric";

export type MatpowerValue = number | string;

export interface MatpowerRow {
  values: MatpowerValue[];
  // The comment of the row's line (see readRows).
  comment: string;
}

export type MatpowerFields = Record<string, number | number[]>;

export interface MatpowerTables {
  tables: Record<string, MatpowerRow[]>;
  textTables: Record<string, string[]>;
  bus: MatpowerFields[];
  gen: MatpowerFields[];
  branch: MatpowerFields[];
  gencost: MatpowerFields[];
}

// Columns by 1-based position, as MATPOWER documents them. These are the
// indices that `red_matpower` reads (bus 1-13, gen 1-10, branch 1-11, with the
// tap in 9 and the status in 11) and the gencost layout that `derivar.jl`
// writes: model, startup, shutdown, n, then the coefficients.
const BUS_COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ["id", 1], ["type", 2], ["pd", 3], ["qd", 4], ["gs", 5], ["bs", 6], ["area", 7],
  ["vm", 8], ["va", 9], ["base_kv", 10], ["zone", 11], ["vmax", 12], ["vmin", 13],
];
const GEN_COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ["bus", 1], ["pg", 2], ["qg", 3], ["qmax", 4], ["qmin", 5], ["vg", 6],
  ["mbase", 7], ["status", 8], ["pmax", 9], ["pmin", 10],
];
const BRANCH_COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ["fbus", 1], ["tbus", 2], ["r", 3], ["x", 4], ["b", 5], ["rate_a", 6],
  ["rate_b", 7], ["rate_c", 8], ["tap", 9], ["shift", 10], ["status", 11],
];
const GENCOST_COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ["model", 1], ["startup", 2], ["shutdown", 3], ["n", 4],
];

// A quoted value, or a run of characters that are neither spaces nor commas.
const TOKEN = /'[^']*'|"[^"]*"|[^\s,]+/g;

/** Splits a line into (code, comment). A `%` inside single quotes is not a comment. */
export function splitComment(line: string): [string, string] {
  let inside = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "'") inside = !inside;
    if (char === "%" && !inside) {
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }
  }
  return [line, ""];
}

/** The values of a piece of a row: numbers when they parse, text otherwise (quotes removed). */
export function tokenizeRow(text: string): MatpowerValue[] {
  const values: MatpowerValue[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const quoted =
      token.length >= 2 &&
      ((token[0] === "'" && token.at(-1) === "'") || (token[0] === '"' && token.at(-1) === '"'));
    values.push(quoted ? token.slice(1, -1) : (parseDecimal(token) ?? token));
  }
  return values;
}

/**
 * Every `mpc.<field> = [ ... ];` table of `text`, with its rows. Rows end at `;`
 * or at a line break. The comment of a line belongs to the last row that the
 * line closes. A table with no rows is not listed.
 */
export function readRows(text: string): Record<string, MatpowerRow[]> {
  const found: Record<string, MatpowerRow[]> = {};
  for (const match of text.matchAll(/mpc\.(\w+)\s*=\s*\[([^\]]*)\]\s*;?/g)) {
    const field = match[1]!;
    const rows: MatpowerRow[] = [];
    let buffer: MatpowerValue[] = [];
    for (const line of match[2]!.split("\n")) {
      const [code, comment] = splitComment(line);
      const pieces = code.split(";");
      let closed = 0;
      pieces.forEach((piece, k) => {
        buffer.push(...tokenizeRow(piece));
        if (k < pieces.length - 1) {
          if (buffer.length > 0) {
            rows.push({ values: buffer, comment: "" });
            closed++;
          }
          buffer = [];
        }
      });
      // A line break closes the pending row too, as MATLAB and MATPOWER do.
      if (buffer.length > 0) {
        rows.push({ values: buffer, comment: "" });
        closed++;
        buffer = [];
      }
      if (comment !== "" && closed > 0) {
        rows[rows.length - 1]!.comment = comment;
      }
    }
    if (rows.length > 0) found[field] = rows;
  }
  return found;
}

/**
 * The rows of `mpc.<field> = { ... };` as strings, one per `;`, without their
 * quotes. An absent table gives an empty list.
 */
export function readTextTable(text: string, field: string): string[] {
  const uncommented = text.replace(/%[^\n]*/g, "");
  const match = new RegExp(`mpc\\.${field}\\s*=\\s*\\{([^}]*)\\}\\s*;`).exec(uncommented);
  if (match === null) return [];
  const rows: string[] = [];
  for (const piece of match[1]!.split(";")) {
    const trimmed = piece.trim();
    if (trimmed === "") continue;
    rows.push(trimmed.replace(/^['"\s]+|['"\s]+$/g, ""));
  }
  return rows;
}

// A row mapped to named fields. A column the row does not have, or that holds
// text, is left out: nothing is invented.
function mapRow(values: MatpowerValue[], columns: ReadonlyArray<readonly [string, number]>): MatpowerFields {
  const fields: MatpowerFields = {};
  for (const [name, column] of columns) {
    const value = values[column - 1];
    if (typeof value === "number") fields[name] = value;
  }
  return fields;
}

function mapSection(
  rows: MatpowerRow[] | undefined,
  columns: ReadonlyArray<readonly [string, number]>,
): MatpowerFields[] {
  return (rows ?? []).map((row) => mapRow(row.values, columns));
}

// gencost: the coefficients are every number after column 4.
function mapGencost(rows: MatpowerRow[] | undefined): MatpowerFields[] {
  return (rows ?? []).map((row) => ({
    ...mapRow(row.values, GENCOST_COLUMNS),
    coeffs: row.values.slice(4).filter((value): value is number => typeof value === "number"),
  }));
}

/** Reads a MATPOWER case: every table and text table, plus the named sections. */
export function readMatpowerTables(text: string): MatpowerTables {
  const tables = readRows(text);

  const names = new Set<string>();
  for (const match of text.replace(/%[^\n]*/g, "").matchAll(/mpc\.(\w+)\s*=\s*\{/g)) {
    names.add(match[1]!);
  }
  const textTables: Record<string, string[]> = {};
  for (const name of names) {
    textTables[name] = readTextTable(text, name);
  }

  return {
    tables,
    textTables,
    bus: mapSection(tables.bus, BUS_COLUMNS),
    gen: mapSection(tables.gen, GEN_COLUMNS),
    branch: mapSection(tables.branch, BRANCH_COLUMNS),
    gencost: mapGencost(tables.gencost),
  };
}
