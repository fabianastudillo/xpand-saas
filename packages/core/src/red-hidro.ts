// The hydrothermal network of an SDDP stage set: the TypeScript port of `red_hidro`
// in packages/XpandCore/src/red.jl (lines 1828-1861, feature 003). It reads
// etapas.csv in the stage directory and centrales_hidro.csv and
// centrales_termicas.csv in its parent. Headers and cells are NOT trimmed (defect
// D3.2, reproduced and kept as the reference behaviour: no fixture exercises it).
// The fixtures of this reader are synthetic only (FR-009).

import { parseDecimal } from "./numeric";
import { sumaSecuencial } from "./sum";
import { dirname, joinpath, lineas, neutro, type Dict, type Leer } from "./red-base";

type Fila = Record<string, string>;

// `filas(p)`: the rows of a CSV as header => cell, without blank lines, and without trimming.
function filas(texto: string): Fila[] {
  const L = lineas(texto);
  const h = L[0]!.split(",");
  return L.slice(1)
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const celdas = l.split(",");
      const f: Fila = {};
      h.forEach((k, i) => {
        if (i < celdas.length) f[k] = celdas[i]!;
      });
      return f;
    });
}

// `r[k]` of Julia: a column the header lacks is a KeyError (defect D3.2, kept as in the reference).
function col(r: Fila, k: string): string {
  const v = r[k];
  if (v === undefined) throw new Error(`KeyError: key "${k}" not found`);
  return v;
}

// `f64(x)`: the number of a cell (blanks trimmed), 0 when it is not one.
function f64(x: string | undefined): number {
  const v = parseDecimal((x ?? "").trim());
  return v === undefined ? 0.0 : v;
}

/**
 * `red_hidro(ruta_etapas)`: the isolated single-bus network of an SDDP case.
 * `etapas` is the path of etapas.csv (its directory holds the stage file); the
 * centrales are read from the parent of that directory.
 */
export function redHidro(etapas: string, leer: Leer): Dict {
  const dir = dirname(etapas);
  const et = filas(leer(joinpath(dir, "etapas.csv")) ?? "");
  // D3.2: an empty selection (no row with stage "1") is an error here, as in the reference.
  const demandas = et
    .filter((r) => col(r, "etapa") === "1")
    .map((r) => (f64(col(r, "demanda_GWh")) * 1000) / f64(col(r, "horas")));
  if (demandas.length === 0) throw new Error("reducing over an empty collection is not allowed");
  const pmaxDem = Math.max(...demandas);

  const gens: Dict[] = [];
  const fuentes = dirname(dir);
  const ch = leer(joinpath(fuentes, "centrales_hidro.csv"));
  if (ch !== undefined) {
    for (const r of filas(ch)) {
      gens.push({
        id: `H_${col(r, "nombre")}`,
        pmax: f64(col(r, "potencia_MW")),
        pmin: 0.0,
        qmax: 0.0,
        qmin: 0.0,
        c2: 0.0,
        c1: 0.0,
        c0: 0.0,
        tec: "hidro",
      });
    }
  }
  const ct = leer(joinpath(fuentes, "centrales_termicas.csv"));
  if (ct !== undefined) {
    for (const r of filas(ct)) {
      gens.push({
        id: `T_${col(r, "nombre")}`,
        pmax: f64(col(r, "potencia_instalada_MW")),
        pmin: 0.0,
        qmax: 0.0,
        qmin: 0.0,
        c2: 0.0,
        c1: f64(col(r, "costo_variable_calc_USD_MWh")),
        c0: 0.0,
        tec: "termica",
      });
    }
  }

  const barra: Dict = {
    id: "1",
    etiqueta: "Ecuador (sistema aislado)",
    tipo: 3,
    pd: pmaxDem,
    qd: 0.0,
    gsh: 0.0,
    bsh: 0.0,
    vmin: 0.95,
    vmax: 1.05,
    kv: 0.0,
    vm0: 0.0,
    va0: 0.0,
    gen: gens,
    pgmax: sumaSecuencial(gens.map((g) => Number(g.pmax))),
  };
  return neutro({
    esquema: "hidro",
    sbase: 100.0,
    refbus: "1",
    nota: "Estudio aislado de PSR: sin red electrica. Un nodo con toda la demanda y la generacion.",
    barras: [barra],
    ac_existentes: [],
    ac_candidatos: [],
    nodos_dc: [],
    ramas_dc: [],
    convertidores: [],
    bancos: [],
    statcom: [],
    sssc: [],
    tcsc: [],
    svc: [],
    proyectos_gen: [],
  }) as Dict;
}
