// The GFM/GFL network: the TypeScript port of `red_gfmgfl` in
// packages/XpandCore/src/red.jl (lines 967-1040, feature 003). BUS carries
// TP/PD (or PD0/QD0 in the unified scheme)/QD/PGM, BRANCH is indexed by (k,i,j),
// and CBUS and SGEN name the sites and the virtual synchronous generators. Pure:
// the files arrive through a `Leer` callback.

import { clave1, escalar, leerDats, par, valores, type Datos } from "./ampl";
import { enteroRedondeado, neutro, num, type Dict, type Leer } from "./red-base";

/** `red_gfmgfl(rutas)`: the network of a GFM/GFL case, from its `.dat` list. */
export function redGfmgfl(rutas: readonly string[], leer: Leer): Dict {
  const datos: Datos = leerDats(
    rutas.flatMap((r) => {
      const texto = leer(r);
      return texto === undefined ? [] : [texto];
    }),
  );
  const Sb = num(escalar(datos, "Sbase"), 100.0);
  // The conference model uses PD/QD; the unified TPWRS model uses PD0/QD0.
  const pdKey = datos.params.has("PD0") ? "PD0" : "PD";
  const qdKey = datos.params.has("QD0") ? "QD0" : "QD";

  const sgen = new Set(clave1(datos, "SGEN"));
  const cbus = new Set(clave1(datos, "CBUS"));

  const barras: Dict[] = [];
  for (const b of clave1(datos, "BUS")) {
    const tp = enteroRedondeado(num(par(datos, "TP", b), 1.0));
    // In the conference model PGM sits in the bus table; in the unified one it sits in SGEN.
    const pgm = num(par(datos, "PGM", b));
    barras.push({
      id: b,
      etiqueta: b,
      tipo: tp === 0 ? 3 : tp,
      pd: num(par(datos, pdKey, b)),
      qd: num(par(datos, qdKey, b)),
      gsh: num(par(datos, "gshb", b)),
      bsh: num(par(datos, "bshb", b)),
      vmin: num(escalar(datos, "Vm"), 0.94),
      vmax: num(escalar(datos, "VM"), 1.06),
      sincrona: sgen.has(b) || pgm > 0,
      sitio_ibr: cbus.has(b),
      pgmax: pgm,
      gen: [],
    });
  }

  // A branch is the key (k,i,j); a key of another length is skipped (as in the reference).
  const ramasEx: Dict[] = [];
  const corredores: Dict[] = [];
  for (const k of valores(datos, "BRANCH")) {
    if (k.length !== 3) continue;
    const [id, i, j] = k as [string, string, string];
    const n0 = enteroRedondeado(num(par(datos, "N0", k)));
    const nmax = enteroRedondeado(num(par(datos, "NMAX", k)));
    const base: Dict = {
      id: `L${id}`,
      de: i,
      a: j,
      r: num(par(datos, "r", k)),
      x: num(par(datos, "x", k)),
      b: num(par(datos, "bsh", k)),
      s: num(par(datos, "SMAX", k)),
      n0,
      nmax,
      costo: num(par(datos, "BCOST", k)),
    };
    if (n0 > 0) ramasEx.push({ ...base, n: n0 });
    if (nmax > 0) corredores.push(base);
  }

  const sitios: Dict[] = clave1(datos, "CBUS").map((i) => ({
    id: i,
    bus: i,
    nbmax: enteroRedondeado(num(par(datos, "NBMAX", i))),
    nbbmax: enteroRedondeado(num(par(datos, "NBBMAX", i))),
    scrmin: num(par(datos, "SCRMIN", i)),
    lcoe: num(par(datos, "LCOE", i)),
    cgfm: num(par(datos, "CGFM", i)),
    ccap: num(par(datos, "CCAP", i)),
  }));

  const sincronas: Dict[] = clave1(datos, "SGEN").map((g) => ({
    id: g,
    bus: g,
    pmax: num(par(datos, "PGM", g)),
    h: num(par(datos, "H", g)),
    snom: num(par(datos, "SNOM", g)),
  }));

  return neutro({
    esquema: "gfmgfl",
    sbase: Sb,
    refbus: "",
    barras,
    ac_existentes: ramasEx,
    ac_candidatos: corredores,
    nodos_dc: [],
    ramas_dc: [],
    convertidores: [],
    bancos: [],
    statcom: [],
    sssc: [],
    sitios_ibr: sitios,
    sincronas,
    contingencias: valores(datos, "CTG").map((k) => k.join("-")),
    proyectos_gen: [],
  }) as Dict;
}
