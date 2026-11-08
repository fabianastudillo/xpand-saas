// The MATPOWER network: the TypeScript port of `red_matpower` in
// packages/XpandCore/src/red.jl (lines 1240-1679, feature 003). It reads a `.m`
// with the row primitives of the 002 reader (`readRows` is `leer_m_filas`), and
// builds the network with the GTNEP extension tables (`gtnep_*` and their
// PowerModels equivalents `ne_*`). Pure: the file arrives as text.

import { readRows, type MatpowerRow, type MatpowerValue } from "./matpower";
import { sumaSecuencial } from "./sum";
import { enteroRedondeado, neutro, textoJulia, type Dict } from "./red-base";

type Fila = MatpowerRow;

// `_cn`: column i (1-based) as a number; def when the column is missing or holds text.
function cn(f: Fila, i: number, def = 0.0): number {
  const v = f.values[i - 1];
  return typeof v === "number" ? v : def;
}

// `_ct`: column i as text; integers without their ".0" so that the keys match.
function ct(f: Fila, i: number, def = ""): string {
  const v: MatpowerValue | undefined = f.values[i - 1];
  if (v === undefined) return def;
  return typeof v === "number" ? textoJulia(v).replace(/\.0$/, "") : v;
}

// `_id(com, def)`: the id that a row carries in its comment, when the comment is one word.
function idDe(com: string, def: string): string {
  const s = com.replace(/\s+copia\s+\d+\s*\/\s*\d+\s*$/, "").trim();
  const p = s === "" ? [] : s.split(/\s+/);
  return p.length === 1 && !/[=;,]/.test(p[0]!) ? p[0]! : def;
}

// `_unicos!`: when a table repeats an id, all its elements are renumbered with the prefix.
function unicos(v: Dict[], pref: string): void {
  if (new Set(v.map((x) => String(x.id))).size === v.length) return;
  v.forEach((x, n) => {
    x.id = pref + String(n + 1);
  });
}

// Row `copia k/n` of a candidate branch: the id before the suffix, and the copies.
const COPIA = /^(.*?)\s+copia\s+(\d+)\s*\/\s*(\d+)\s*$/;

/** `red_matpower(ruta)`: the network of a MATPOWER case (extended tables included), from its text. */
export function redMatpower(texto: string): Dict {
  const F = readRows(texto);
  const tab = (n: string): Fila[] => F[n] ?? [];
  const vals = (n: string): MatpowerValue[][] => tab(n).map((f) => f.values);
  let Sb = 100.0;
  const bm = tab("baseMVA");
  if (bm.length > 0) Sb = cn(bm[0]!, 1, 100.0);
  const sumaPmax = (lista: Dict[]): number => sumaSecuencial(lista.map((x) => Number(x.pmax)));

  // Generators in service, by bus. An SVC row of mpc.gen_svc marks the generator of the same row.
  const genEn = new Map<string, Dict[]>();
  const svcFila = new Map<number, number>();
  vals("gen_svc").forEach((f, k0) => {
    const bd = enteroRedondeado(cn({ values: f, comment: "" }, 1, 0.0));
    if (bd > 0) svcFila.set(k0 + 1, bd);
  });
  let filaGen = 0;
  for (const f of tab("gen")) {
    filaGen++;
    // Column 8 is the status: a unit out of service does not dispatch and is left out.
    if (!(cn(f, 8, 1.0) > 0.5)) continue;
    const b = ct(f, 1);
    const lista = genEn.get(b) ?? [];
    genEn.set(b, lista);
    const reg: Dict = {
      id: `G${b}_${lista.length + 1}`,
      pmax: cn(f, 9),
      pmin: cn(f, 10),
      qmax: cn(f, 4),
      qmin: cn(f, 5),
      pg: cn(f, 2),
      qg: cn(f, 3),
      vg: cn(f, 6, 1.0),
      mbase: cn(f, 7, 0.0),
    };
    lista.push(reg);
    const svc = svcFila.get(filaGen);
    if (svc !== undefined) reg.svc = svc;
  }

  const barras: Dict[] = [];
  let refbus = "";
  for (const f of tab("bus")) {
    const b = ct(f, 1);
    const tipo = enteroRedondeado(cn(f, 2, 1.0));
    // The reference bus is the one of type 3, as `escribir_matpower` writes it.
    if (tipo === 3 && refbus === "") refbus = b;
    const gens = genEn.get(b) ?? [];
    barras.push({
      id: b,
      etiqueta: b,
      tipo,
      pd: cn(f, 3),
      qd: cn(f, 4),
      // MATPOWER gives Gs and Bs in MW and MVAr at 1 pu: they go to pu on Sbase.
      gsh: cn(f, 5) / Sb,
      bsh: cn(f, 6) / Sb,
      vmin: cn(f, 13, 0.94),
      vmax: cn(f, 12, 1.06),
      kv: cn(f, 10),
      vm0: cn(f, 8),
      va0: cn(f, 9),
      gen: gens,
      pgmax: sumaPmax(gens),
    });
  }

  const acEx: Dict[] = [];
  tab("branch").forEach((f, n0) => {
    if (!(cn(f, 11, 1.0) > 0.5)) return;
    // The `ratio` of a LINE is 0 in MATPOWER, which means identity: it becomes 1.
    let tap = cn(f, 9, 1.0);
    if (!(tap > 0)) tap = 1.0;
    acEx.push({
      id: `E${n0 + 1}`,
      de: ct(f, 1),
      a: ct(f, 2),
      r: cn(f, 3),
      x: cn(f, 4),
      b: cn(f, 5),
      s: cn(f, 6),
      tap,
      desf: cn(f, 10),
    });
  });
  // The bus pair of each existing branch, to go back from the pair to the id.
  const porPar = new Map<string, string>();
  for (const l of acEx) {
    const ida = `${String(l.de)}\u0000${String(l.a)}`;
    const idb = `${String(l.a)}\u0000${String(l.de)}`;
    if (!porPar.has(ida)) porPar.set(ida, String(l.id));
    if (!porPar.has(idb)) porPar.set(idb, String(l.id));
  }

  // Candidate corridors. A corridor with nmax > 1 is written once per circuit (`copia k/n`): the copies fold back into one.
  const acCand: Dict[] = [];
  const vistos = new Set<string>();
  tab("ne_branch").forEach((f, n0) => {
    const n = n0 + 1;
    const com = f.comment;
    const m = COPIA.exec(com);
    const idc = m === null ? idDe(com, `C${n}`) : m[1]!.trim();
    // Without a comment the convention of the project cases applies: column 15 is nmax (1 if absent).
    const nmax = m === null ? Math.max(1, enteroRedondeado(cn(f, 15, 1.0))) : Number(m[3]);
    if (m !== null && vistos.has(idc)) return;
    vistos.add(idc);
    acCand.push({
      id: idc,
      de: ct(f, 1),
      a: ct(f, 2),
      r: cn(f, 3),
      x: cn(f, 4),
      b: cn(f, 5),
      s: cn(f, 6),
      nmax,
      costo: cn(f, 14),
      // Column 16 is lc_grupo (legs of a Tr3 tied together); 0 means no group.
      grupo: Math.max(0, enteroRedondeado(cn(f, 16, 0.0))),
      sale: "",
    });
  });
  // Series operation (seccionamientos) of mpc.gtnep_lc_sale: a candidate takes out an existing branch.
  {
    const neId: string[] = tab("ne_branch").map((f, n0) => {
      const m = COPIA.exec(f.comment);
      return m === null ? idDe(f.comment, `C${n0 + 1}`) : m[1]!.trim();
    });
    const porId = new Map<string, Dict>();
    for (const c of acCand) porId.set(String(c.id), c);
    for (const f of vals("gtnep_lc_sale")) {
      const a = enteroRedondeado(cn({ values: f, comment: "" }, 1, 0.0));
      const b = enteroRedondeado(cn({ values: f, comment: "" }, 2, 0.0));
      const cand = a >= 1 && a <= neId.length && b >= 1 ? porId.get(neId[a - 1]!) : undefined;
      if (cand !== undefined) cand.sale = `E${b}`;
    }
  }

  // Shunt compensation: the broken-down bank of gtnep_caps wins over the whole bank of ne_shunt.
  const bancos: Dict[] = [];
  if (tab("gtnep_caps").length > 0) {
    tab("gtnep_caps").forEach((f, n0) => {
      bancos.push({
        id: idDe(f.comment, `BC${n0 + 1}`),
        bus: ct(f, 1),
        hmax: Math.max(1, enteroRedondeado(cn(f, 2, 1.0))),
        qmod: cn(f, 3),
        cmod: cn(f, 4),
        cvar: cn(f, 4),
        cbay: cn(f, 5, 0.0),
        costo_legado: f.values.length < 5,
      });
    });
  } else {
    tab("ne_shunt").forEach((f, n0) => {
      bancos.push({
        id: idDe(f.comment, `BC${n0 + 1}`),
        bus: ct(f, 1),
        hmax: 1,
        qmod: cn(f, 3) * Sb,
        cmod: cn(f, 5),
      });
    });
  }

  const svc: Dict[] = [];
  if (tab("gtnep_svc").length > 0) {
    tab("gtnep_svc").forEach((f, n0) => {
      svc.push({
        id: idDe(f.comment, `SV${n0 + 1}`),
        bus: ct(f, 1),
        qmin: cn(f, 2, -50.0),
        qmax: cn(f, 3, 150.0),
        costo: cn(f, 4),
      });
    });
  } else {
    // ne_svc gives bmin and bmax in pu on the base: here everything goes in MVAr.
    tab("ne_svc").forEach((f, n0) => {
      svc.push({
        id: idDe(f.comment, `SV${n0 + 1}`),
        bus: ct(f, 1),
        qmin: cn(f, 2) * Sb,
        qmax: cn(f, 3) * Sb,
        costo: cn(f, 5),
      });
    });
  }

  const statcom: Dict[] = [];
  if (tab("gtnep_statcom").length > 0) {
    tab("gtnep_statcom").forEach((f, n0) => {
      statcom.push({
        id: idDe(f.comment, `ST${n0 + 1}`),
        bus: ct(f, 1),
        s: cn(f, 2, 150.0),
        costo: cn(f, 3),
        g: cn(f, 4, 0.0),
        b: cn(f, 5, -10.0),
        vmin: cn(f, 6, 0.9),
        vmax: cn(f, 7, 1.1),
      });
    });
  } else {
    // Symmetric range -S..+S: the nominal is the upper end, in pu.
    tab("ne_statcom").forEach((f, n0) => {
      statcom.push({
        id: idDe(f.comment, `ST${n0 + 1}`),
        bus: ct(f, 1),
        s: cn(f, 3) * Sb,
        costo: cn(f, 5),
      });
    });
  }

  // Series compensation (SSSC and TCSC) sits on a branch: gtnep_* names it by id and ne_* by its bus pair.
  // The two tables are read and combined by position, as the same loop writes them.
  const serie = (
    gt: string,
    ne: string,
    pref: string,
    campos: (d: Dict, g: Fila, n: Fila) => void,
  ): Dict[] => {
    const out: Dict[] = [];
    const tg = tab(gt);
    const tn = tab(ne);
    const vacia: Fila = { values: [], comment: "" };
    for (let k = 0; k < Math.max(tg.length, tn.length); k++) {
      const g = tg[k] ?? vacia;
      const n = tn[k] ?? vacia;
      let de = ct(n, 1);
      let a = ct(n, 2);
      let ln = ct(g, 1);
      const resuelto = porPar.get(`${de}\u0000${a}`) ?? "";
      if (resuelto !== "") ln = resuelto;
      if (de === "" && ln !== "") {
        const e = acEx.find((l) => String(l.id) === ln);
        if (e !== undefined) {
          de = String(e.de);
          a = String(e.a);
        }
      }
      const d: Dict = {
        id: idDe(g.comment === "" ? n.comment : g.comment, `${pref}${k + 1}`),
        linea: ln,
        de,
        a,
      };
      campos(d, g, n);
      out.push(d);
    }
    return out;
  };
  const sssc = serie("gtnep_sssc", "ne_sssc", "SC", (d, g, n) => {
    const hay = g.values.length > 0;
    d.r = cn(g, 2);
    d.x = hay ? cn(g, 3, 0.01) : cn(n, 3, 0.01);
    d.vmax = hay ? cn(g, 4, 0.25) : cn(n, 4, 0.25);
    d.s = hay ? cn(g, 5, 150.0) : cn(n, 5, 150.0);
    d.costo = hay ? cn(g, 6) : cn(n, 7);
    // sabs_mvar (column 7): the rating of the series converter; without it, the rating of the branch.
    d.sabs = hay ? cn(g, 7, Number(d.s)) : d.s;
  });
  const tcsc = serie("gtnep_tcsc", "ne_tcsc", "TC", (d, g, n) => {
    const hay = g.values.length > 0;
    d.kmin = hay ? cn(g, 2, -0.2) : cn(n, 3, -0.2);
    d.kmax = hay ? cn(g, 3, 0.7) : cn(n, 4, 0.7);
    d.nlev = enteroRedondeado(hay ? cn(g, 4, 4.0) : cn(n, 5, 4.0));
    d.costo = hay ? cn(g, 5) : cn(n, 7);
  });

  // BESS: gtnep_bess, or the storage table of PowerModels (energy in column 4, charge rating in 6).
  const bess: Dict[] = [];
  if (tab("gtnep_bess").length > 0) {
    tab("gtnep_bess").forEach((f, n0) => {
      bess.push({
        id: idDe(f.comment, `BS${n0 + 1}`),
        bus: ct(f, 1),
        p: cn(f, 2, 50.0),
        h: cn(f, 3, 4.0),
        eta: cn(f, 4, 0.88),
        cinv: cn(f, 5, 1.0),
      });
    });
  } else {
    tab("ne_storage").forEach((f, n0) => {
      let p = cn(f, 6);
      if (!(p > 0)) p = cn(f, 10, 50.0);
      let e = cn(f, 4);
      if (!(e > 0)) e = 4.0 * p;
      bess.push({
        id: idDe(f.comment, `BS${n0 + 1}`),
        bus: ct(f, 1),
        p,
        h: p > 0 ? e / p : 4.0,
        eta: cn(f, 8, 0.88),
        cinv: e > 0 ? cn(f, 18) / e : 0.0,
      });
    });
  }

  const ibr: Dict[] = tab("gtnep_ibr").map((f, n0) => {
    const reg: Dict = {
      id: idDe(f.comment, `IB${n0 + 1}`),
      bus: ct(f, 1),
      nbmax: enteroRedondeado(cn(f, 2, 4.0)),
    };
    ["smod", "csite", "ccap", "cgfm", "cgfmf", "chv", "hvmax", "imaxl", "imaxm", "lcoe"].forEach((k, i) => {
      reg[k] = cn(f, 2 + i + 1);
    });
    return reg;
  });

  // Candidate generators: gtnep_gen carries gamma (it limits the annual energy of the project) and wins
  // over ne_gen; candidate_gen is the name the old cases of the project use.
  const gproj: Dict[] = [];
  if (tab("gtnep_gen").length > 0) {
    tab("gtnep_gen").forEach((f, n0) => {
      gproj.push({
        id: idDe(f.comment, `GP${n0 + 1}`),
        bus: ct(f, 1),
        pnom: cn(f, 2, 100.0),
        gamma: cn(f, 3, 1.0),
        costo: cn(f, 4),
        tec: ct(f, 5),
      });
    });
  } else if (tab("ne_gen").length > 0) {
    tab("ne_gen").forEach((f, n0) => {
      gproj.push({
        id: idDe(f.comment, `GP${n0 + 1}`),
        bus: ct(f, 1),
        pnom: cn(f, 9, 100.0),
        gamma: 1.0,
        costo: cn(f, 11),
        tec: ct(f, 12),
      });
    });
  } else {
    tab("candidate_gen").forEach((f, n0) => {
      gproj.push({
        id: idDe(f.comment, `GP${n0 + 1}`),
        bus: ct(f, 1),
        pnom: cn(f, 9),
        gamma: 1.0,
        costo: 0.0,
        tec: "",
      });
    });
  }
  // The GPROJ record of the GTEP projects (the house table): it is pinned to its project by the id in the comment.
  const fg = tab("gtnep_gproj");
  if (fg.length > 0) {
    const porId = new Map<string, Dict>();
    for (const p of gproj) porId.set(String(p.id), p);
    fg.forEach((f, n0) => {
      const p = porId.get(idDe(f.comment, `GP${n0 + 1}`));
      if (p === undefined) return;
      ["kp", "km", "on", "tc", "cfom", "c1", "for", "life", "capf", "d"].forEach((k, i) => {
        p[k] = cn(f, 4 + i + 1);
      });
      p.gamma = cn(f, 4, 1.0);
    });
  }

  // HVDC. The DC nodes come as existing (busdc) or as candidates (busdc_ne or ne_busdc).
  const nodosDc: Dict[] = [];
  for (const [clave, existe] of [
    ["busdc", true],
    ["busdc_ne", false],
    ["ne_busdc", false],
  ] as const) {
    for (const f of tab(clave)) {
      // busdc_i grid Pdc Vdc basekVdc Vdcmax Vdcmin Cdc
      nodosDc.push({
        id: ct(f, 1),
        existente: existe,
        pload: cn(f, 3),
        kv: cn(f, 5, 345.0),
        umax: cn(f, 6, 1.1),
        umin: cn(f, 7, 0.9),
      });
    }
  }
  const ramasDc: Dict[] = [];
  for (const [clave, existe] of [
    ["branchdc", true],
    ["branchdc_ne", false],
    ["ne_branchdc", false],
  ] as const) {
    tab(clave).forEach((f, n0) => {
      ramasDc.push({
        id: idDe(f.comment, (existe ? "D" : "DN") + String(n0 + 1)),
        de: ct(f, 1),
        a: ct(f, 2),
        r: cn(f, 3),
        rate: cn(f, 6),
        polos: 1,
        existente: existe,
        // Status (column 9): in the TNEP cases the "existing" links come switched off.
        en_servicio: existe && cn(f, 9, 1.0) > 0.5,
        costo: existe ? 0.0 : cn(f, 10),
      });
    });
  }
  const convs: Dict[] = [];
  for (const [clave, existe] of [
    ["convdc", true],
    ["convdc_ne", false],
    ["ne_convdc", false],
  ] as const) {
    tab(clave).forEach((f, n0) => {
      // PowerModelsACDC format: P_g and Q_g (5 and 6) are the exchange with the AC network, type_ac (4) the control mode,
      // status in 22, the capacity in Pacmax and Pacmin (31, 32) and Qacmax and Qacmin (33, 34), the candidate cost in 35.
      convs.push({
        id: idDe(f.comment, (existe ? "V" : "VN") + String(n0 + 1)),
        nodo_dc: ct(f, 1),
        bus: ct(f, 2),
        srated: Math.max(Math.abs(cn(f, 31)), Math.abs(cn(f, 32))),
        existente: existe,
        en_servicio: existe && cn(f, 22, 1.0) > 0.5,
        pg: cn(f, 5),
        qg: cn(f, 6),
        type_ac: enteroRedondeado(cn(f, 4, 1.0)),
        type_dc: enteroRedondeado(cn(f, 3, 1.0)),
        vtar: cn(f, 8, 1.0),
        kv: cn(f, 18, 345.0),
        qmax: cn(f, 33),
        qmin: cn(f, 34),
        qacmax: cn(f, 33),
        qacmin: cn(f, 34),
        pacmax: cn(f, 31),
        pacmin: cn(f, 32),
        costo: existe ? 0.0 : cn(f, 35),
      });
    });
  }
  unicos(ramasDc, "D");
  unicos(convs, "V");
  // The exact rated power, when the .m carries it (the house table); otherwise it is deduced from Pacmax.
  const sn = tab("gtnep_convdc");
  if (sn.length === convs.length) {
    convs.forEach((c, k) => {
      const f = sn[k]!;
      let v = cn(f, 1, 0.0);
      if (v > 0) c.srated = v;
      v = cn(f, 2, -1.0);
      if (v > 0) c.imax = v;
      v = cn(f, 3, -1.0);
      if (v > 0) c.pdcmax = v;
      v = cn(f, 4, 1.0);
      if (v < 0) c.pdcmin = v;
      v = cn(f, 5, -1.0);
      if (v > 0) c.idcmax = v;
    });
  }
  // A DC link may cite a node that is missing from busdc: the node is put back, so that the link is drawn and modelled.
  const idsDc = new Set(nodosDc.map((n) => String(n.id)));
  for (const r of ramasDc) {
    for (const k of ["de", "a"] as const) {
      const s = String(r[k]);
      if (s === "" || idsDc.has(s)) continue;
      idsDc.add(s);
      nodosDc.push({ id: s, existente: r.existente === true, pload: 0.0, kv: 345.0, umax: 1.1, umin: 0.9 });
    }
  }

  return neutro({
    esquema: "matpower",
    sbase: Sb,
    refbus,
    barras,
    ac_existentes: acEx,
    ac_candidatos: acCand,
    nodos_dc: nodosDc,
    ramas_dc: ramasDc,
    convertidores: convs,
    bancos,
    statcom,
    sssc,
    tcsc,
    svc,
    bess,
    ibr,
    proyectos_gen: gproj,
  }) as Dict;
}
