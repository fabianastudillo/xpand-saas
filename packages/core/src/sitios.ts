// Renewable sites of a case: the TypeScript port of the site functions of
// packages/XpandCore/src/red.jl (lines 72-456 of the reference, feature 003).
// `ibr_sitios.dat` (IBRSITE, IBRPAV, PUNTOS, IBRSITE_EXT), `gen_candidatos.dat`
// (NGX), `puntos.dat` and `estrellas.dat` (ESTRELLA). Pure: the files arrive
// through a `Leer` callback. Julia's sums are sequential (decision D1).

import { parseDecimal } from "./numeric";
import { clave1, escalar, leerDats, par, type Datos } from "./ampl";
import { sumaSecuencial } from "./sum";
import {
  bus,
  enteroDeToken,
  enteroRedondeado,
  joinpath,
  lineas,
  num,
  textoJulia,
  txt,
  type Dict,
  type Leer,
} from "./red-base";

export const COLS_IBRSITE = [
  "bus", "nbmax", "smod_mva", "csite", "ccap", "cgfm", "cgfmf", "om_res", "imaxl", "imaxm",
  "hvr_s", "nq", "v0", "q0", "xv", "emin", "emax", "scrmin", "ifab", "cf",
  "nbbmax", "smodb_mva", "cbp", "cbe", "cgfmb", "ebmax_mwh", "eb_fijo_mwh", "etac", "etad", "socmin",
  "hvb_s", "nqb", "v0b", "q0b", "xvb", "ebminv", "ebmaxv", "fom",
] as const;

export const COLS_IBRSITE_EXT = [
  "site", "nombre", "tec", "estado", "ano", "nb_min", "gb_min", "gb_max", "nbb_min", "gbb_min",
  "gbb_max", "hutil_h", "eb_modo", "cred", "ngx_origen", "gen_asociado", "grupo", "fuente",
] as const;

export const TEXTO_EXT: ReadonlySet<string> = new Set([
  "nombre", "tec", "estado", "eb_modo", "ngx_origen", "gen_asociado", "grupo", "fuente",
]);
export const TEC_SITIO = ["FV", "EOL4", "EOL3", "EOL3X", "BESS"] as const;
export const EB_MODOS = ["por_modulo", "libre", "nominal"] as const;
export const ESTADOS_SITIO = ["candidato", "comprometido", "fijo"] as const;

// Defaults of the site record (§1.2 of the design, with its sources there).
export const OMISION_SITIO: Dict = {
  estado: "candidato", ano: 0, ngx_origen: "-", gen_asociado: "-", grupo: "-",
  fuente: "estimado (omisiones XPAND)",
  smod_mw: 50.0, imaxl: 1.1, imaxm: 1.3, nq: 0.03, v0: 1.02, q0: 0.0, xv: 0.1,
  emin: 0.9, emax: 1.15,
  smodb_mw: 50.0, hutil_h: 4.0, eb_modo: "por_modulo", eta_pct: 85.0, socmin_pct: 20.0,
  hvb_s: 8.0, nqb: 0.03, v0b: 1.02, q0b: 0.0, xvb: 0.08, ebminv: 0.9, ebmaxv: 1.15,
  csite_musd: 1.7, cgfm_musd_mod: 2.25, cgfmf_musd: 2.0, om_res_usd_mwh: 0.0,
  cbp_kusd_mw: 241.0, cbe_usd_kwh: 236.0, cgfmb_kusd_mw: 7.15,
  ifab: 1.1,
};
const HUTIL_OMISION_H = 4.0; // OMISION_SITIO["hutil_h"]

// Per technology: CCAP [USD/kW] and FOM [USD/kW-year] (ATB 2024), HVR [B7], and firm credit.
export const OMISION_TEC: Record<string, Record<string, number>> = {
  FV: { ccap_usd_kw: 1197.0, fom_usd_kw_ano: 17.99, hvr_s: 0.0, cred: 0.0 },
  EOL4: { ccap_usd_kw: 1315.0, fom_usd_kw_ano: 29.26, hvr_s: 3.0, cred: 0.239 },
  EOL3: { ccap_usd_kw: 1315.0, fom_usd_kw_ano: 29.26, hvr_s: 0.0, cred: 0.239 },
  EOL3X: { ccap_usd_kw: 1315.0, fom_usd_kw_ano: 29.26, hvr_s: 0.0, cred: 0.239 },
  BESS: { ccap_usd_kw: 0.0, fom_usd_kw_ano: 0.0, hvr_s: 0.0, cred: 0.0 },
};

/** A value of a table cell: the text of a quoted token, or the number of an unquoted one. */
export type Valor = string | number;

/** A row of a site table: its tokens, which of them were quoted, and its comment (`Fila` of data-model.md). */
export interface Fila {
  toks: string[];
  texto: boolean[];
  coment: string;
}

export interface Tabla {
  columnas: string[];
  filas: Fila[];
}

/** A table as `_tablas_ibr_sitios` returns it: its columns and its rows as text. */
export type TablaTexto = {
  columnas: string[];
  filas: string[][];
};

/** `_linea_dat`: the tokens of one `.dat` line, quotes with `''` as the escaped apostrophe. */
export function lineaDat(l: string): { toks: string[]; texto: boolean[]; coment: string; cierra: boolean } {
  const toks: string[] = [];
  const texto: boolean[] = [];
  let coment = "";
  let cierra = false;
  const cs = [...l];
  const n = cs.length;
  let buf = "";
  let hay = false;
  let esq = false;
  let enq = false;
  let i = 0;
  while (i < n) {
    const c = cs[i]!;
    if (enq) {
      if (c === "'") {
        if (i < n - 1 && cs[i + 1] === "'") {
          buf += "'";
          i += 2;
          continue;
        }
        enq = false;
      } else {
        buf += c;
      }
    } else if (c === "'") {
      enq = true;
      hay = true;
      esq = true;
    } else if (c === "#") {
      coment = cs.slice(i + 1).join("").trim();
      break;
    } else if (c === ";") {
      cierra = true;
      const resto = cs.slice(i + 1).join("");
      const k = resto.indexOf("#");
      if (k !== -1) coment = resto.slice(k + 1).trim();
      break;
    } else if (/\s/.test(c)) {
      if (hay) {
        toks.push(buf);
        texto.push(esq);
      }
      buf = "";
      hay = false;
      esq = false;
    } else {
      buf += c;
      hay = true;
    }
    i += 1;
  }
  if (hay) {
    toks.push(buf);
    texto.push(esq);
  }
  return { toks, texto, coment, cierra };
}

/**
 * `tablas_sitio`: the tables `param : NAME : col... :=` of a `.dat` text, with the
 * comment of each row (quotes respected: `#` and `;` inside them are text).
 * `cabecera` is the comment before the first table (the traceability of the file).
 */
export function tablasSitio(texto: string | undefined): { tablas: Record<string, Tabla>; cabecera: string[] } {
  const tablas: Record<string, Tabla> = {};
  const cabecera: string[] = [];
  if (texto === undefined) return { tablas, cabecera };
  let actual = "";
  let vista = false;
  for (let l of lineas(texto)) {
    if (actual === "") {
      const m = /^\s*param\s*:\s*([A-Za-z0-9_]+)\s*:\s*([^:#]*?):=/.exec(l);
      if (m === null) {
        if (!vista && l.trim().startsWith("#")) cabecera.push(l.trim().replace(/^#+/, "").trim());
        continue;
      }
      vista = true;
      actual = m[1]!;
      tablas[actual] = { columnas: m[2]!.trim().split(/\s+/).filter((c) => c !== ""), filas: [] };
      l = l.slice(m.index + m[0].length);
    }
    const { toks, texto: textos, coment, cierra } = lineaDat(l);
    if (toks.length > 0) tablas[actual]!.filas.push({ toks, texto: textos, coment });
    if (cierra) actual = "";
  }
  return { tablas, cabecera };
}

/** `_pnum`: the decimal number of a token (a comma as decimal point), NaN when it is not one. */
export function pnum(s: string): number {
  const v = parseDecimal(s.replace(/,/g, "."));
  return v === undefined ? NaN : v;
}

/**
 * `_fila_por_col`: the values of a row by column name, and the leading tokens
 * (the extra ones before the columns, whose first one is the site key).
 * Undefined when the row has fewer tokens than columns.
 */
export function filaPorCol(
  f: Fila,
  cols: readonly string[],
): { valores: Record<string, Valor>; cabeza: string[] } | undefined {
  const off = f.toks.length - cols.length;
  if (off < 0) return undefined;
  const valores: Record<string, Valor> = {};
  cols.forEach((c, j) => {
    valores[c] = f.texto[off + j] ? f.toks[off + j]! : pnum(f.toks[off + j]!);
  });
  return { valores, cabeza: f.toks.slice(0, off) };
}

function esRenovable(tec: unknown): boolean {
  const t = txt(tec).toLowerCase();
  return t.includes("solar") || t.includes("eol") || ["fv", "pv", "wind", "wd"].includes(t);
}

/** The NGX candidate of a site: the fields `ngx_del_caso` gives for it. */
export interface Ngx {
  tec: string;
  bus: string;
  pnom_mw: number;
  cinv: number;
  cred: number | null;
  nota: string;
}

/** `sitio_de_dat`: one site in the units of its record (§4.3), from its IBRSITE row. */
export function sitioDeDat(
  i: number,
  v: Record<string, Valor>,
  pav: readonly (readonly [number, number])[],
  ext: Record<string, Valor> | undefined,
  coment = "",
  opciones: { ngx?: Record<string, Ngx>; horas?: ReadonlyMap<number, number> } = {},
): Dict {
  const ngx = opciones.ngx ?? {};
  const horas = opciones.horas ?? new Map<number, number>();
  const g = (k: string, def = 0.0): number => {
    const x = v[k];
    return typeof x === "number" && Number.isFinite(x) ? x : def;
  };
  const smod = g("smod_mva");
  const smodb = g("smodb_mva");
  const etac = g("etac", 1.0);
  const etad = g("etad", 1.0);
  const nbmax = enteroRedondeado(g("nbmax"));
  const nbbmax = enteroRedondeado(g("nbbmax"));
  const pavOrdenado = [...pav].sort((a, b) => a[0] - b[0]);
  const s: Dict = {
    id: i,
    bus: bus(g("bus")),
    comentario: coment,
    nbmax,
    smod_mw: smod,
    imaxl: g("imaxl"),
    imaxm: g("imaxm"),
    hvr_s: g("hvr_s"),
    nq: g("nq"),
    v0: g("v0"),
    q0: g("q0"),
    xv: g("xv"),
    emin: g("emin"),
    emax: g("emax"),
    scrmin: g("scrmin"),
    ifab: g("ifab"),
    cf: g("cf"),
    nbbmax,
    smodb_mw: smodb,
    ebmax_mwh: g("ebmax_mwh"),
    eb_fijo_mwh: g("eb_fijo_mwh"),
    etac,
    etad,
    eta_pct: etac * etad * 100,
    socmin_pct: g("socmin") * 100,
    hvb_s: g("hvb_s"),
    nqb: g("nqb"),
    v0b: g("v0b"),
    q0b: g("q0b"),
    xvb: g("xvb"),
    ebminv: g("ebminv"),
    ebmaxv: g("ebmaxv"),
    // Economics: the per-module values of the .dat become per MW and per MWh (§4.3).
    csite_musd: g("csite"),
    ccap_usd_kw: smod > 0 ? (g("ccap") * 1000) / smod : 0.0,
    cgfm_musd_mod: g("cgfm"),
    cgfmf_musd: g("cgfmf"),
    fom_usd_kw_ano: g("fom") * 1000,
    om_res_usd_mwh: g("om_res") * 1e6,
    cbp_kusd_mw: smodb > 0 ? (g("cbp") * 1000) / smodb : 0.0,
    cbe_usd_kwh: g("cbe") * 1000,
    cgfmb_kusd_mw: smodb > 0 ? (g("cgfmb") * 1000) / smodb : 0.0,
    pav: pavOrdenado.map(([p, x]) => ({ punto: p, pav: x })),
  };
  // A per-module cost without its module does not fit "per MW": it is kept apart.
  if (!(smod > 0) && g("ccap") !== 0) s.ccap_musd_mod_sin_modulo = g("ccap");
  if (!(smodb > 0) && !(g("cbp") === 0 && g("cgfmb") === 0)) {
    s.cbp_musd_mod_sin_modulo = g("cbp");
    s.cgfmb_musd_mod_sin_modulo = g("cgfmb");
  }

  if (ext !== undefined) {
    s.inferido = false;
    for (const k of COLS_IBRSITE_EXT) {
      if (k === "site") continue;
      const x = ext[k];
      if (x === undefined) continue;
      if (TEXTO_EXT.has(k)) s[k] = textoJulia(x);
      else if (["ano", "nb_min", "gb_min", "gb_max", "nbb_min", "gbb_min", "gbb_max"].includes(k)) {
        s[k] = enteroRedondeado(Number(x));
      } else s[k] = Number(x);
    }
  } else {
    s.inferido = true;
    const pal = coment.trim() === "" ? [] : coment.trim().split(/\s+/);
    const nom = pal.length === 0 ? `S${i}` : pal[0]!;
    s.nombre = nom;
    s.tec = nbmax === 0 ? "BESS" : g("hvr_s") > 0 ? "EOL4" : "FV";
    s.estado = "candidato";
    s.ano = 0;
    s.nb_min = 0;
    s.gb_min = 0;
    s.gb_max = nbmax;
    s.nbb_min = 0;
    s.gbb_min = 0;
    s.gbb_max = nbbmax;
    const nx = Object.prototype.hasOwnProperty.call(ngx, nom) ? ngx[nom] : undefined;
    s.ngx_origen = nx !== undefined && esRenovable(nx.tec) ? nom : "-";
    const cr = nx === undefined ? null : nx.cred;
    s.cred = cr !== null ? cr : OMISION_TEC[String(s.tec)]!.cred!;
    if (g("eb_fijo_mwh") > 0) {
      s.eb_modo = "nominal";
      s.hutil_h = smodb > 0 ? g("eb_fijo_mwh") / smodb : HUTIL_OMISION_H;
    } else {
      s.eb_modo = "libre";
      s.hutil_h =
        nbbmax > 0 && smodb > 0
          ? (g("ebmax_mwh") * (1 - g("socmin")) * etad) / (nbbmax * smodb)
          : HUTIL_OMISION_H;
    }
    s.gen_asociado = "-";
    s.grupo = "-";
    const nota = nx === undefined ? "" : nx.nota;
    s.fuente = nota !== "" ? nota : pal.length > 1 ? coment.trim() : "";
  }

  // Read-only references: the power and CAPEX of the PROJECT (NGX of origin).
  const origen = typeof s.ngx_origen === "string" ? s.ngx_origen : "-";
  const nx = Object.prototype.hasOwnProperty.call(ngx, origen) ? ngx[origen] : undefined;
  if (nx !== undefined) {
    const pmw = nx.pnom_mw;
    s.p_proy_mw = pmw;
    if (pmw > 0) s.ccap_proy_usd_kw = (nx.cinv / pmw) * 1000;
  }
  s.mw_res_max = nbmax * smod;
  s.mw_bess_max = nbbmax * smodb;

  // Capacity factor from the hours of the points (puntos.dat). `hs` decides
  // whether the factor is written; for non-negative hours its sign does not
  // depend on the order of the points (decision D1.1, pending for negative hours).
  if (horas.size > 0 && pav.length > 0) {
    const hs = sumaSecuencial([...horas.keys()].sort((a, b) => a - b).map((k) => horas.get(k)!));
    if (hs > 0) {
      s.cf_calculado = sumaSecuencial(pav.map(([p, x]) => (horas.get(p) ?? 0.0) * x)) / 8760;
    }
  }
  return s;
}

/**
 * `leer_sitios`: the sites of `dir/ibr_sitios.dat` (empty without the file or
 * without IBRSITE), in the units of the record.
 */
export function leerSitios(
  dir: string,
  leer: Leer,
  opciones: { ngx?: Record<string, Ngx>; horas?: ReadonlyMap<number, number> } = {},
): Dict[] {
  const { tablas } = tablasSitio(leer(joinpath(dir, "ibr_sitios.dat")));
  const ibrsite = tablas.IBRSITE;
  if (ibrsite === undefined) return [];
  const cols = ibrsite.columnas;
  const pav = new Map<number, [number, number][]>();
  const ibrpav = tablas.IBRPAV;
  if (ibrpav !== undefined) {
    for (const f of ibrpav.filas) {
      const fila = filaPorCol(f, ibrpav.columnas);
      if (fila === undefined) continue;
      const site = enteroRedondeado(Number(fila.valores.site));
      const lista = pav.get(site) ?? [];
      pav.set(site, lista);
      lista.push([enteroRedondeado(Number(fila.valores.punto)), Number(fila.valores.pav)]);
    }
  }
  const ext = new Map<number, Record<string, Valor>>();
  const ibrext = tablas.IBRSITE_EXT;
  if (ibrext !== undefined) {
    for (const f of ibrext.filas) {
      const fila = filaPorCol(f, ibrext.columnas);
      if (fila === undefined) continue;
      ext.set(enteroRedondeado(Number(fila.valores.site)), fila.valores);
    }
  }
  const out: Dict[] = [];
  for (const f of ibrsite.filas) {
    const fila = filaPorCol(f, cols);
    if (fila === undefined || fila.cabeza.length === 0) continue;
    const i = enteroDeToken(fila.cabeza[0]!);
    out.push(
      sitioDeDat(i, fila.valores, pav.get(i) ?? [], ext.get(i), f.coment, opciones),
    );
  }
  return out;
}

/**
 * `ngx_del_caso`: the candidate plants of the case (id -> record). Without the
 * parsed `.dat` (`d`), the file `gen_candidatos.dat` is read here.
 */
export function ngxDelCaso(dir: string, leer: Leer, d?: Datos): Record<string, Ngx> {
  const out: Record<string, Ngx> = {};
  const ruta = joinpath(dir, "gen_candidatos.dat");
  const texto = leer(ruta);
  let datos = d;
  if (datos === undefined) {
    if (texto === undefined) return out;
    datos = leerDats([texto]);
  }
  const sb = num(escalar(datos, "Sbase"), 100.0);
  for (const p of clave1(datos, "NGX")) {
    const c = par(datos, "gx_cred", p);
    out[p] = {
      tec: txt(par(datos, "gx_tech", p)),
      bus: bus(par(datos, "gx_bus", p)),
      pnom_mw: sb * num(par(datos, "gx_Pnom", p)),
      cinv: num(par(datos, "gx_cinv", p)),
      cred: typeof c === "number" ? c : null,
      nota: "",
    };
  }
  if (texto !== undefined) {
    for (const l of lineas(texto)) {
      const m = /^#\s+([A-Za-z][A-Za-z0-9_]*):\s+(.+?)\s*$/.exec(l);
      if (m === null) continue;
      if (Object.prototype.hasOwnProperty.call(out, m[1]!)) out[m[1]!]!.nota = m[2]!;
    }
  }
  return out;
}

/** `horas_puntos`: the hours of each operating point (PUNTOS of puntos.dat, else of ibr_sitios.dat). */
export function horasPuntos(dir: string, leer: Leer): Map<number, number> {
  for (const f of ["puntos.dat", "ibr_sitios.dat"]) {
    const t = tablasSitio(leer(joinpath(dir, f))).tablas.PUNTOS;
    if (t === undefined || !t.columnas.includes("horas")) continue;
    const out = new Map<number, number>();
    for (const fl of t.filas) {
      const fila = filaPorCol(fl, t.columnas);
      if (fila === undefined) continue;
      const punto = fila.valores.punto;
      const p = typeof punto === "number" ? enteroRedondeado(punto) : enteroDeToken(fila.cabeza[0]!);
      out.set(p, Number(fila.valores.horas));
    }
    return out;
  }
  return new Map<number, number>();
}

/** `puntos_caso`: the operating points of the case, ascending and without repeats; [1] without a table. */
export function puntosCaso(dir: string, leer: Leer): number[] {
  for (const f of ["puntos.dat", "ibr_sitios.dat"]) {
    const t = tablasSitio(leer(joinpath(dir, f))).tablas.PUNTOS;
    if (t === undefined) continue;
    const ps: number[] = [];
    for (const fl of t.filas) {
      const fila = filaPorCol(fl, t.columnas);
      if (fila === undefined) continue;
      const punto = fila.valores.punto;
      ps.push(typeof punto === "number" ? enteroRedondeado(punto) : enteroDeToken(fila.cabeza[0]!));
    }
    if (ps.length > 0) return [...new Set(ps)].sort((a, b) => a - b);
  }
  return [1];
}

/**
 * `estrellas_caso`: the star buses of the case (ESTRELLA of estrellas.dat). The
 * reference returns a Set; the neutral form is its ascending list (decision D2).
 */
export function estrellasCaso(dir: string, leer: Leer): string[] {
  const t = tablasSitio(leer(joinpath(dir, "estrellas.dat"))).tablas.ESTRELLA;
  const out = new Set<string>();
  if (t === undefined) return [];
  for (const fl of t.filas) {
    const fila = filaPorCol(fl, t.columnas);
    if (fila === undefined || typeof fila.valores.bus !== "number") continue;
    out.add(bus(fila.valores.bus));
  }
  return [...out].sort();
}

/**
 * `_tablas_ibr_sitios` (red.jl line 72), read by `red_misocp` for the `ibr_tpwrs`
 * section. It ends a table at the first `;`, even inside quotes: defect D3.1,
 * reproduced and not corrected here (no fixture exercises it).
 */
export function tablasIbrSitios(texto: string | undefined): Record<string, TablaTexto> | undefined {
  if (texto === undefined) return undefined;
  const sinComentario = (l: string): string => {
    let dentro = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === "'") dentro = !dentro;
      if (ch === "#" && !dentro) return l.slice(0, i);
    }
    return l;
  };
  const cuerpo = lineas(texto).map(sinComentario).join("\n");
  const out: Record<string, TablaTexto> = {};
  for (const m of cuerpo.matchAll(/param\s*:\s*([A-Za-z0-9_]+)\s*:\s*([^:]*?):=([\s\S]*?);/g)) {
    const columnas = m[2]!.trim().split(/\s+/).filter((c) => c !== "");
    const filas = m[3]!
      .split("\n")
      .map((l) => [...l.matchAll(/'(?:[^']|'')*'|\S+/g)].map((t) => t[0]))
      .filter((f) => f.length > 0);
    out[m[1]!] = { columnas, filas };
  }
  if (out.IBRSITE_EXT !== undefined) {
    const te = tablasSitio(texto).tablas.IBRSITE_EXT;
    if (te !== undefined) {
      const q = (t: string, es: boolean): string => (es ? "'" + t.replaceAll("'", "''") + "'" : t);
      out.IBRSITE_EXT = {
        columnas: te.columnas,
        filas: te.filas.map((f) => f.toks.map((t, k) => q(t, f.texto[k]!))),
      };
    }
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/** `_nombres_inom`: name and class of each branch from the comments of inom.dat. */
export function nombresInom(texto: string | undefined): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  if (texto === undefined) return out;
  for (const l of lineas(texto)) {
    const m = /^\s*(\S+)\s+[^#]*#\s*(.*?)\s*\[(\w+)\]/.exec(l);
    if (m === null || m[1]!.startsWith("param")) continue;
    out[m[1]!] = [m[2]!.trim(), m[3]!];
  }
  return out;
}

