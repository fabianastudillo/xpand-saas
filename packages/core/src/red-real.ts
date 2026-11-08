// The real-system network: the TypeScript port of `red_real` in
// packages/XpandCore/src/red.jl (lines 1700-1820, feature 003). It reads a
// `red.json` (JSON.parsefile in the reference). The fixtures of this reader are
// synthetic only (FR-009): no SNI, CENACE or SDDP data enters the repository.

import { sumaSecuencial } from "./sum";
import { enteroRedondeado, neutro, type Dict, type Json } from "./red-base";

type Obj = Record<string, unknown>;

// Julia's `get(o, k, def)`: the value when the key is there (a JSON null included), else def.
function get(o: Obj, k: string, def: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : def;
}

// Julia's `Float64(get(o, k, def))` for the JSON numbers of the file.
function f64(o: Obj, k: string, def = 0.0): number {
  const v = get(o, k, def);
  return typeof v === "number" ? v : def;
}

// Julia's `String(get(o, k, def))`.
function str(o: Obj, k: string, def = ""): string {
  return String(get(o, k, def));
}

// The items of a JSON array, or none (`_l`).
function lista(o: Obj, k: string): Obj[] {
  const v = get(o, k, []);
  return Array.isArray(v) ? (v as Obj[]) : [];
}

/** `red_real(ruta)`: the network of a real system from its `red.json` text. */
export function redReal(texto: string): Dict {
  const d = JSON.parse(texto) as Obj;
  const Sb = f64(d, "sbase", 100.0);

  // Generators by bus. The bus key is the JSON value itself, as in the reference.
  const genpor = new Map<unknown, Dict[]>();
  for (const g of lista(d, "generacion")) {
    const b = get(g, "bus", null);
    if (b === null) continue;
    const lst = genpor.get(b) ?? [];
    genpor.set(b, lst);
    lst.push({
      id: str(g, "nombre", "central"),
      bus: b as Json,
      pmax: f64(g, "mw", 0.0),
      pmin: 0.0,
      qmax: 0.35 * f64(g, "mw", 0.0),
      qmin: -0.35 * f64(g, "mw", 0.0),
      tec: str(g, "fuente", ""),
      lon: get(g, "lon", null) as Json,
      lat: get(g, "lat", null) as Json,
    });
  }

  const barras: Dict[] = [];
  for (const b of lista(d, "barras")) {
    const id = get(b, "id", 0);
    const gs = genpor.get(id) ?? [];
    // A substation without a name in the source is labelled with its number, not with «sin nombre».
    let nom = str(b, "nombre", "");
    if (nom === "" || /sin\s+nombre/i.test(nom)) nom = `SE-${String(id)}`;
    barras.push({
      id: id as Json,
      etiqueta: nom,
      tipo: gs.length === 0 ? 1 : 2,
      pd: f64(b, "pd", 0.0),
      qd: f64(b, "qd", 0.0),
      gsh: 0.0,
      bsh: 0.0,
      vmin: 0.95,
      vmax: 1.05,
      lon: get(b, "lon", null) as Json,
      lat: get(b, "lat", null) as Json,
      kv: f64(b, "kv", 0.0),
      kv_todas: get(b, "kv_todas", []) as Json,
      operador: str(b, "operador", ""),
      gen: gs,
      pgmax: sumaSecuencial(gs.map((x) => Number(x.pmax))),
    });
  }

  const ac: Dict[] = lista(d, "lineas").map((l, i0) => {
    const kv = f64(l, "kv", 0.0);
    return {
      id: `L${i0 + 1}_${enteroRedondeado(kv)}`,
      de: get(l, "de", 0) as Json,
      a: get(l, "a", 0) as Json,
      r: f64(l, "r", 0.0),
      x: f64(l, "x", 0.0),
      b: f64(l, "b", 0.0),
      s: f64(l, "mva", 100.0),
      tap: 1.0,
      kv,
      km: f64(l, "km", 0.0),
      circuitos: get(l, "circuitos", 1) as Json,
      conductor: str(l, "conductor", ""),
      // The route of the corridor, as a GeoJSON list of [lon, lat] pairs, when the source brings it.
      ruta: get(l, "ruta", null) as Json,
      operador: str(l, "operador", ""),
    };
  });

  // argmax: the first bus of the largest generation (0 when there are no buses).
  let refbus: Json = 0;
  if (barras.length > 0) {
    let best = 0;
    barras.forEach((b, k) => {
      if (Number(b.pgmax) > Number(barras[best]!.pgmax)) best = k;
    });
    refbus = barras[best]!.id as Json;
  }

  // Candidates: what a scenario added (corridors, compensation and generation projects).
  const candAc: Dict[] = lista(d, "candidatos_ac").map((l, i0) => {
    const kv = f64(l, "kv", 0.0);
    const fallback = `C${i0 + 1}${kv > 0 ? "_" + String(enteroRedondeado(kv)) : ""}`;
    return {
      id: String(get(l, "id", fallback)),
      de: get(l, "de", get(l, "de_bus", 0)) as Json,
      a: get(l, "a", get(l, "a_bus", 0)) as Json,
      r: f64(l, "r", 0.0),
      x: f64(l, "x", 0.0),
      b: f64(l, "b", 0.0),
      s: f64(l, "s", f64(l, "mva", 100.0)),
      nmax: Math.trunc(f64(l, "nmax", 1)),
      costo: f64(l, "costo", 0.0),
      kv,
      km: f64(l, "km", 0.0),
      nota: str(l, "nota", ""),
    };
  });

  // Candidate banks, statcoms and series devices: their own lists, with the fields they keep.
  const cand = (k: string, campos: string[]): Dict[] =>
    lista(d, `candidatos_${k}`).map((x, i0) => {
      const out: Dict = { id: String(get(x, "id", `${k}${i0 + 1}`)) };
      for (const c of campos) out[c] = get(x, c, 0.0) as Json;
      out.bus = get(x, "bus", 0) as Json;
      out.nota = str(x, "nota", "");
      return out;
    });

  return neutro({
    esquema: "real",
    sbase: Sb,
    refbus,
    nombre: str(d, "nombre", ""),
    fuente: str(d, "fuente", ""),
    parametros_estimados: get(d, "parametros_estimados", true) as Json,
    descartes: get(d, "descartes", {}) as Json,
    barras,
    ac_existentes: ac,
    ac_candidatos: candAc,
    nodos_dc: [],
    ramas_dc: [],
    convertidores: [],
    bancos: cand("bc", ["qmod", "hmax", "cmod"]),
    statcom: cand("st", ["s", "costo"]),
    sssc: cand("sc", ["s", "vmax", "costo"]),
    proyectos_gen: lista(d, "candidatos_gen").map((x, i0) => ({
      id: String(get(x, "id", `GP${i0 + 1}`)),
      bus: get(x, "bus", 0) as Json,
      tec: str(x, "tec", ""),
      pnom: f64(x, "pnom", f64(x, "mw", 0.0)),
      costo: f64(x, "costo", 0.0),
      nota: str(x, "nota", ""),
    })),
  }) as Dict;
}
