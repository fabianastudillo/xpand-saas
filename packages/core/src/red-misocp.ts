// The MISOCP network: the TypeScript port of `red_misocp` in
// packages/XpandCore/src/red.jl (lines 457-963, feature 003, decision D1-D3).
// The list of `.dat` is merged in order (base first, then the active technologies);
// a file that is not in the case reads as an empty set (`isfile`). Pure: every file
// arrives through a `Leer` callback.

import { clave1, escalar, leerDat, leerDats, par, type Datos } from "./ampl";
import { sumaSecuencial } from "./sum";
import {
  bus,
  dirname,
  enteroRedondeado,
  joinpath,
  neutro,
  num,
  stripChars,
  textoJulia,
  txt,
  type Dict,
  type Leer,
} from "./red-base";
import {
  leerSitios,
  horasPuntos,
  ngxDelCaso,
  nombresInom,
  tablasIbrSitios,
  type TablaTexto,
} from "./sitios";

// Scalars of the case that the network keeps (red.jl `_ESCALARES_ECON`).
const ESCALARES_ECON = [
  "CRF", "OPF_SCALE", "load_scale", "irate", "closs", "loss_pv", "Rlo", "Rhi",
  "LOLPmax", "phi", "pv_margen", "gen_FOR", "exist_capf", "loss_price", "sobrecarga_n1", "voll", "rpf",
  "frec_f0", "frec_dfdb", "frec_droop", "frec_tdpfr", "frec_dfqss", "frec_dfnad", "frec_rocofmax",
  "frec_dload", "frec_tresb", "frec_tresp",
  "frec_kappa_nadir",
  "termico_corriente",
] as const;

// Optional tables read next to the base `.dat` (`dinamica.dat` and `econ.dat` are
// merged as data; the others only feed the `ibr_tpwrs` section).
const DATOS_JUNTO_AL_BASE = ["dinamica.dat", "econ.dat", "tpwrs.dat", "reactores.dat"] as const;
const TABLAS_JUNTO_AL_BASE = [
  "gen_pav.dat", "gen_on.dat", "puntos.dat", "estrellas.dat", "ngx_dinamica.dat", "banda_emergencia.dat", "ens_op.dat",
  "tomas_puntos.dat", "shunts_puntos.dat", "ramas_puntos.dat", "tr3_estrella.dat", "carga_puntos.dat",
  "oltc.dat", "gen_op_puntos.dat", "ens_op_puntos.dat", "pf_puntos.dat", "iec_cc.dat", "carga_modelo.dat",
  "gen_ctrl_puntos.dat", "inom.dat", "lineas_abiertas.dat", "ref_local_desempate.dat", "iec_datos.dat",
] as const;

/**
 * Every file the reader opens beside the base `.dat` without it being declared in the case (the two lists above plus
 * the renewable-site tables of sitios.ts). The case importer copies these when they exist, so an imported case builds
 * the same network as in the reference.
 */
export const FICHEROS_JUNTO_AL_BASE: readonly string[] = [
  ...DATOS_JUNTO_AL_BASE,
  ...TABLAS_JUNTO_AL_BASE,
  "ibr_sitios.dat",
  "gen_candidatos.dat",
];

type Registro = Dict;

// `_nivel`: the higher voltage of the two ends of a branch, and whether they differ
// (a transformer, when both are positive and more than 0.5 kV apart).
function nivelDe(kv: Map<string, number>, i: string, j: string): [number, boolean] {
  const a = kv.get(i) ?? 0.0;
  const b = kv.get(j) ?? 0.0;
  return [Math.max(a, b), a > 0 && b > 0 && Math.abs(a - b) > 0.5];
}

// Like Julia's `strip(string(x), '\'')`: the text of a table token without its apostrophes.
const sinApostrofos = (t: string): string => stripChars(t, "'");

/**
 * `red_misocp(rutas)`: the network of a MISOCP case, from the `.dat` list
 * `rutas` (the base `.dat` must end in `/base.dat`, as in the reference).
 */
export function redMisocp(rutas: readonly string[], leer: Leer): Dict {
  const rs = [...rutas];
  const datos: Datos = leerDats(
    rs.flatMap((r) => {
      const texto = leer(r);
      return texto === undefined ? [] : [texto];
    }),
  );
  const ib = rs.findIndex((r) => r.replaceAll("\\", "/").endsWith("/base.dat"));
  let ibrTpwrs: Record<string, TablaTexto> | undefined;

  if (ib !== -1) {
    const dirBase = dirname(rs[ib]!);
    // Data that lives beside the base: merged as data when it exists and is not already in the list.
    for (const f of DATOS_JUNTO_AL_BASE) {
      const r = joinpath(dirBase, f);
      const texto = leer(r);
      if (texto !== undefined && !rs.includes(r)) leerDat(datos, texto);
    }
    ibrTpwrs = tablasIbrSitios(leer(joinpath(dirBase, "ibr_sitios.dat")));
    for (const f of TABLAS_JUNTO_AL_BASE) {
      const gp = tablasIbrSitios(leer(joinpath(dirBase, f)));
      if (gp === undefined) continue;
      ibrTpwrs ??= {};
      Object.assign(ibrTpwrs, gp);
    }
  }

  // Renewable sites (F1): a file that cannot be read does not stop the network; it is reported.
  const sitios: Registro[] = [];
  let sitiosError = "";
  if (ib !== -1) {
    const dcaso = dirname(rs[ib]!);
    if (leer(joinpath(dcaso, "ibr_sitios.dat")) !== undefined) {
      try {
        const ngx = clave1(datos, "NGX").length === 0 ? ngxDelCaso(dcaso, leer) : ngxDelCaso(dcaso, leer, datos);
        sitios.push(...leerSitios(dcaso, leer, { ngx, horas: horasPuntos(dcaso, leer) }));
      } catch (err) {
        sitiosError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const Sb = num(escalar(datos, "Sbase"), 100.0);

  // Generators, grouped by bus. The operating point (`op_*`) is read only when the case brings it.
  const genEn = new Map<string, Registro[]>();
  const hayOp = datos.params.has("op_pg");
  for (const g of clave1(datos, "GEN")) {
    const b = bus(par(datos, "gen_bus", g));
    const reg: Registro = {
      id: g,
      pmax: Sb * num(par(datos, "Pgmax", g)),
      pmin: Sb * num(par(datos, "Pgmin", g)),
      qmax: Sb * num(par(datos, "Qgmax", g)),
      qmin: Sb * num(par(datos, "Qgmin", g)),
      c2: num(par(datos, "cg2", g)),
      c1: num(par(datos, "cg1", g)),
      c0: num(par(datos, "cg0", g)),
    };
    const adecuacion: [string, string][] = [
      ["for", "gen_FOR"], ["capf", "gen_capf"],
      ["h", "gen_h"], ["sn", "gen_sn"], ["xdpp", "gen_xdpp"], ["ngnum", "gen_ngnum"],
      ["ibr", "gen_ibr"],
      ["kfactor", "gen_kfactor"],
      ["droop", "gen_droop"],
      ["xnet_skmax", "gen_xnet_skmax"], ["xnet_skmin", "gen_xnet_skmin"],
      ["xnet_rxmax", "gen_xnet_rxmax"], ["xnet_rxmin", "gen_xnet_rxmin"],
      ["xnet_cmax", "gen_xnet_cmax"], ["xnet_cmin", "gen_xnet_cmin"],
      ["xnet_heq", "gen_xnet_heq"], ["xnet_kpf", "gen_xnet_kpf"],
    ];
    for (const [k, p] of adecuacion) {
      const v = par(datos, p, g);
      if (v !== undefined) reg[k] = num(v);
    }
    const sv = par(datos, "gen_svc", g);
    if (sv !== undefined && num(sv) > 0) reg.svc = enteroRedondeado(num(sv));
    const cl = par(datos, "gen_clase", g);
    if (cl !== undefined) reg.clase = stripChars(textoJulia(cl), "'\" ");
    if (hayOp) {
      reg.pg = Sb * num(par(datos, "op_pg", g));
      reg.qg = Sb * num(par(datos, "op_qg", g));
      reg.vg = num(par(datos, "op_vg", g));
      const c = num(par(datos, "op_ctrl", g), -1.0);
      if (c >= 0) reg.control = c === 0 ? "pq" : c === 1 ? "pv" : "sl";
    }
    // An SVC that regulates the voltage of its bus is "pv", whatever the extracted point says.
    if (reg.svc === 1) reg.control = "pv";
    const lista = genEn.get(b) ?? [];
    genEn.set(b, lista);
    lista.push(reg);
  }

  const barras: Registro[] = [];
  for (const b of clave1(datos, "BUS")) {
    const gens = genEn.get(bus(b)) ?? [];
    barras.push({
      id: b,
      etiqueta: b,
      tipo: enteroRedondeado(num(par(datos, "bus_type", b), 1.0)),
      pd: Sb * num(par(datos, "Pd", b)),
      qd: Sb * num(par(datos, "Qd", b)),
      gsh: num(par(datos, "Gsh", b)),
      bsh: num(par(datos, "Bsh", b)),
      vmin: num(par(datos, "Vmin", b), 0.95),
      vmax: num(par(datos, "Vmax", b), 1.05),
      kv: num(par(datos, "kV", b), 0.0),
      vm0: num(par(datos, "op_vm", b), 0.0),
      va0: num(par(datos, "op_va", b), 0.0),
      gen: gens,
      pgmax: sumaSecuencial(gens.map((x) => num(x.pmax))),
    });
  }

  // Voltage level of each bus, for the level of the branches.
  const kvDe = new Map<string, number>();
  for (const b of barras) kvDe.set(String(b.id), num(b.kv, 0.0));

  const acExist: Registro[] = [];
  for (const l of clave1(datos, "ELINE")) {
    const de = bus(par(datos, "el_f", l));
    const a = bus(par(datos, "el_t", l));
    const [kv, trafo] = nivelDe(kvDe, de, a);
    const u: Registro = {
      id: l,
      de: bus(par(datos, "el_f", l)),
      a: bus(par(datos, "el_t", l)),
      r: num(par(datos, "el_r", l)),
      x: num(par(datos, "el_x", l)),
      b: num(par(datos, "el_bch", l)),
      s: Sb * num(par(datos, "el_S", l)),
      tap: num(par(datos, "el_tap", l), 1.0),
      desf: num(par(datos, "el_desf", l), 0.0),
      tside: num(par(datos, "el_tside", l), 1.0),
      kv,
      trafo,
    };
    acExist.push(u);
    // A line between buses of different nominal voltage whose tap is only the base correction
    // is not a transformer (it has line charging): it is marked as such.
    const kd = num(par(datos, "kV", de), 0.0);
    const ka = num(par(datos, "kV", a), 0.0);
    const t = Number(u.tap);
    if (kd > 0 && ka > 0 && kd !== ka && Number(u.b) > 1e-6 && (Math.abs(t - ka / kd) < 1e-4 || Math.abs(t - kd / ka) < 1e-4)) {
      u.linea_base = true;
      u.trafo = false;
    }
  }

  // Labels of the drawing: name and class of each branch from the comments of inom.dat.
  if (ib !== -1) {
    const nomInom = nombresInom(leer(joinpath(dirname(rs[ib]!), "inom.dat")));
    for (const b of barras) {
      if (!("nombre" in b)) b.nombre = txt(b.etiqueta);
    }
    const etq = new Map<string, string>();
    for (const b of barras) etq.set(String(b.id), txt(b.nombre));
    for (const u of acExist) {
      const nc = Object.prototype.hasOwnProperty.call(nomInom, String(u.id)) ? nomInom[String(u.id)] : undefined;
      if (nc === undefined) {
        u.nombre = `${etq.get(String(u.de)) ?? String(u.de)} – ${etq.get(String(u.a)) ?? String(u.a)}`;
      } else {
        u.nombre = nc[0];
        if (nc[1] !== "") u.clase = nc[1];
      }
    }
  }

  const acCand: Registro[] = [];
  for (const l of clave1(datos, "LCAN")) {
    // Two ideal taps (af at the `de` end, at at the `a` end) are one tap at `de`: N = af/at, z' = at^2 z.
    let af = num(par(datos, "lc_af", l), 1.0);
    let at = num(par(datos, "lc_at", l), 1.0);
    if (!(af > 0 && at > 0)) {
      af = 1.0;
      at = 1.0;
    }
    const sale = par(datos, "lc_sale", l);
    acCand.push({
      id: l,
      de: bus(par(datos, "lc_f", l)),
      a: bus(par(datos, "lc_t", l)),
      r: num(par(datos, "lc_r", l)) * (at * at),
      x: num(par(datos, "lc_x", l)) * (at * at),
      b: num(par(datos, "lc_bch", l)) / (at * at),
      s: Sb * num(par(datos, "lc_S", l)),
      nmax: enteroRedondeado(num(par(datos, "lc_Nmax", l), 1.0)),
      costo: num(par(datos, "lc_cost", l)),
      tside: 1.0,
      tap: af / at,
      desf: num(par(datos, "lc_desf", l), 0.0),
      grupo: enteroRedondeado(num(par(datos, "lc_grupo", l), 0.0)),
      sale: sale === undefined ? "" : textoJulia(sale),
      af,
      at,
      r_dat: num(par(datos, "lc_r", l)),
      x_dat: num(par(datos, "lc_x", l)),
      b_dat: num(par(datos, "lc_bch", l)),
    });
  }

  const nodosDc: Registro[] = clave1(datos, "EDC").map((e) => ({
    id: e,
    umin: num(par(datos, "Udcmin", e), 0.9),
    umax: num(par(datos, "Udcmax", e), 1.1),
    pload: Sb * num(par(datos, "Pload_dc", e)),
  }));

  const ramasDc: Registro[] = [];
  for (const r of clave1(datos, "DDC")) {
    const reg: Registro = {
      id: r,
      de: bus(par(datos, "dc_f", r)),
      a: bus(par(datos, "dc_t", r)),
      rate: Sb * num(par(datos, "dc_rate", r)),
      polos: enteroRedondeado(num(par(datos, "dc_p", r), 1.0)),
      existente: num(par(datos, "dc_exist", r)) > 0.5,
      costo: num(par(datos, "dc_cost", r)),
    };
    const v = par(datos, "dc_r", r);
    if (v !== undefined) reg.r = num(v);
    ramasDc.push(reg);
  }

  const convs: Registro[] = [];
  for (const c of clave1(datos, "CONV")) {
    const reg: Registro = {
      id: c,
      bus: bus(par(datos, "cv_iac", c)),
      nodo_dc: bus(par(datos, "cv_edc", c)),
      srated: Sb * num(par(datos, "cv_Srated", c)),
      existente: num(par(datos, "cv_exist", c)) > 0.5,
      costo: num(par(datos, "cv_cost", c)),
    };
    // Limits in MW/MVAr/MVA only when the case declares them: the motor derives them from Srated otherwise.
    const conLimite: [string, string][] = [
      ["imax", "cv_Imax"], ["pacmax", "cv_Pacmax"], ["pacmin", "cv_Pacmin"],
      ["qacmax", "cv_Qacmax"], ["qacmin", "cv_Qacmin"],
      ["pdcmax", "cv_Pdcmax"], ["pdcmin", "cv_Pdcmin"], ["idcmax", "cv_Idcmax"],
    ];
    for (const [k, p] of conLimite) {
      const v = par(datos, p, c);
      if (v !== undefined) reg[k] = Sb * num(v);
    }
    // Transformer, reactor, filter and losses of the converter: dimensionless, not scaled by Sb.
    const adimensional: [string, string][] = [
      ["havetf", "cv_haveTf"], ["rtf", "cv_rtf"], ["xtf", "cv_xtf"],
      ["tap", "cv_tap"], ["havere", "cv_haveRe"], ["rc", "cv_rc"],
      ["xc", "cv_xc"], ["bf", "cv_bf"],
      ["ufmin", "cv_Ufmin"], ["ufmax", "cv_Ufmax"],
      ["ucmin", "cv_Ucmin"], ["ucmax", "cv_Ucmax"],
      ["la", "cv_la"], ["lb", "cv_lb"], ["lc", "cv_lc"],
    ];
    for (const [k, p] of adimensional) {
      const v = par(datos, p, c);
      if (v !== undefined) reg[k] = num(v);
    }
    convs.push(reg);
  }

  // Shunt banks: the site cost (`bc_cbay`) and the module cost (`bc_cvar`); the legacy `bc_cmod` alone is the module cost.
  const bancos: Registro[] = [];
  for (const i of clave1(datos, "NBC")) {
    const cm = par(datos, "bc_cmod", i);
    const cv = par(datos, "bc_cvar", i);
    const cb = par(datos, "bc_cbay", i);
    const cvar = cv === undefined ? num(cm) : num(cv);
    bancos.push({
      id: i,
      bus: bus(par(datos, "bc_bus", i)),
      hmax: enteroRedondeado(num(par(datos, "bc_Hmax", i), 1.0)),
      qmod: Sb * num(par(datos, "bc_qmod", i)),
      cmod: cvar,
      cvar,
      cbay: num(cb),
      costo_legado: cv === undefined,
    });
  }

  const statcom: Registro[] = clave1(datos, "NST").map((i) => ({
    id: i,
    bus: bus(par(datos, "st_bus", i)),
    s: Sb * num(par(datos, "st_S", i)),
    g: num(par(datos, "st_g", i)),
    b: num(par(datos, "st_b", i), num(par(datos, "st_S", i))),
    vmin: num(par(datos, "st_Vmin", i), 0.9),
    vmax: num(par(datos, "st_Vmax", i), 1.1),
    cfix: num(par(datos, "st_cfix", i)),
    cvar: num(par(datos, "st_cvar", i)),
    costo: num(par(datos, "st_cost", i)),
  }));

  // Lookup of the existing branches by id (the last one wins, as in Julia's Dict).
  const idxEl = new Map<string, Registro>();
  for (const l of acExist) idxEl.set(String(l.id), l);
  const sssc: Registro[] = [];
  for (const l of clave1(datos, "LSC")) {
    const ln = txt(par(datos, "sc_line", l));
    const e = idxEl.get(ln);
    const reg: Registro = {
      id: l,
      linea: ln,
      de: e === undefined ? "" : txt(e.de),
      a: e === undefined ? "" : txt(e.a),
      s: Sb * num(par(datos, "sc_S", l)),
      sabs: Sb * num(par(datos, "sc_Sabs", l), num(par(datos, "sc_S", l))),
      vmax: num(par(datos, "sc_Vmax", l)),
      costo: num(par(datos, "sc_cost", l)),
    };
    const propias: [string, string][] = [["r", "sc_r"], ["x", "sc_x"], ["bsh", "sc_bsh"]];
    for (const [k, p] of propias) {
      const v = par(datos, p, l);
      if (v !== undefined) reg[k] = num(v);
    }
    sssc.push(reg);
  }

  const tcsc: Registro[] = [];
  for (const l of clave1(datos, "LTC")) {
    const ln = txt(par(datos, "tc_line", l));
    const e = idxEl.get(ln);
    tcsc.push({
      id: l,
      linea: ln,
      de: e === undefined ? "" : txt(e.de),
      a: e === undefined ? "" : txt(e.a),
      kmin: num(par(datos, "tc_kmin", l), -0.2),
      kmax: num(par(datos, "tc_kmax", l), 0.7),
      nlev: enteroRedondeado(num(par(datos, "tc_nlev", l), 4.0)),
      costo: num(par(datos, "tc_cost", l)),
    });
  }

  const svc: Registro[] = clave1(datos, "NSV").map((i) => ({
    id: i,
    bus: bus(par(datos, "sv_bus", i)),
    qmin: Sb * num(par(datos, "sv_Bmin", i), -0.5),
    qmax: Sb * num(par(datos, "sv_Bmax", i), 1.5),
    costo: num(par(datos, "sv_cost", i)),
  }));

  const gproj: Registro[] = [];
  for (const p of clave1(datos, "GPROJ")) {
    const reg: Registro = {
      id: p,
      bus: bus(par(datos, "gp_bus", p)),
      tec: txt(par(datos, "gp_tech", p)),
      pnom: num(par(datos, "gp_Pnom", p)),
      gamma: num(par(datos, "gp_gamma", p), 1.0),
      costo: num(par(datos, "gp_cinv", p)),
    };
    const ficha: [string, string][] = [
      ["kp", "gp_kp"], ["km", "gp_km"], ["on", "gp_ON"], ["tc", "gp_Tc"],
      ["cfom", "gp_cfom"], ["c1", "gp_c1"], ["for", "gp_FOR"],
      ["life", "gp_life"], ["capf", "gp_capf"], ["d", "gp_D"],
      ["cfix", "gp_cfix"],
    ];
    for (const [k, q] of ficha) {
      const v = par(datos, q, p);
      if (v !== undefined) reg[k] = num(v);
    }
    gproj.push(reg);
  }
  // NGX (gen_candidatos.dat): candidate plants of an imported case, listed with the projects.
  for (const p of clave1(datos, "NGX")) {
    const c = par(datos, "gx_cred", p);
    gproj.push({
      id: p,
      bus: bus(par(datos, "gx_bus", p)),
      tec: txt(par(datos, "gx_tech", p)),
      pnom: Sb * num(par(datos, "gx_Pnom", p)),
      qmax: Sb * num(par(datos, "gx_Qmax", p)),
      cvar: num(par(datos, "gx_cvar", p)),
      omfijo: num(par(datos, "gx_omfijo", p)),
      cred: typeof c === "number" ? c : null,
      gamma: 1.0,
      costo: num(par(datos, "gx_cinv", p)),
    });
  }

  // BESS (NBT) and IBR GFM/GFL (NIB): the motor loads them, the drawing reads them too.
  const bess: Registro[] = clave1(datos, "NBT").map((t) => {
    const p = Sb * num(par(datos, "bt_P", t));
    const h = num(par(datos, "bt_h", t), 4.0);
    return {
      id: t,
      bus: bus(par(datos, "bt_bus", t)),
      p,
      h,
      eta: num(par(datos, "bt_eta", t), 0.88),
      cinv: p * h > 0 ? num(par(datos, "bt_cinv", t)) / (p * h) : 0.0,
    };
  });
  const ibr: Registro[] = clave1(datos, "NIB").map((t) => ({
    id: t,
    bus: bus(par(datos, "ib_bus", t)),
    nbmax: enteroRedondeado(num(par(datos, "ib_NBmax", t), 4.0)),
    smod: Sb * num(par(datos, "ib_Smod", t)),
    csite: num(par(datos, "ib_csite", t)),
    ccap: num(par(datos, "ib_ccap", t)),
    cgfm: num(par(datos, "ib_cgfm", t)),
    cgfmf: num(par(datos, "ib_cgfmf", t)),
    chv: num(par(datos, "ib_chv", t)),
    hvmax: num(par(datos, "ib_hvmax", t), 10.0),
    imaxl: num(par(datos, "ib_imaxl", t), 1.0),
    imaxm: num(par(datos, "ib_imaxm", t), 1.2),
    lcoe: num(par(datos, "ib_lcoe", t)),
  }));

  // Economic scalars the case brings (only those).
  const econ: Dict = {};
  for (const k of ESCALARES_ECON) {
    const v = escalar(datos, k);
    if (typeof v === "number") econ[k] = v;
  }

  // Marks for the drawing: star node of a Tr3, OLTC branch, and branch to an external network.
  if (ibrTpwrs !== undefined) {
    const est = ibrTpwrs.ESTRELLA;
    if (est !== undefined) {
      const ids = new Set(est.filas.filter((f) => f.length >= 2).map((f) => sinApostrofos(f[1]!)));
      for (const b of barras) {
        if (ids.has(String(b.id))) b.estrella = true;
      }
    }
    const ol = ibrTpwrs.OLTC;
    if (ol !== undefined) {
      const ids = new Set(ol.filas.filter((f) => f.length >= 1).map((f) => sinApostrofos(f[0]!)));
      for (const l of acExist) {
        if (ids.has(String(l.id))) l.oltc = true;
      }
    }
  }
  const xb = new Set<string>();
  for (const b of barras) {
    const gens = Array.isArray(b.gen) ? (b.gen as Registro[]) : [];
    if (gens.some((g) => num(g.xnet_skmax, 0.0) > 0 || num(g.xnet_skmin, 0.0) > 0)) xb.add(String(b.id));
  }
  for (const l of acExist) {
    if (xb.has(String(l.de)) || xb.has(String(l.a))) l.internacional = true;
  }

  const salida: Dict = {
    esquema: "misocp",
    sbase: Sb,
    econ,
    ibr_tpwrs: ibrTpwrs ?? {},
    reactores: clave1(datos, "NRX").map((r) => ({
      id: r,
      bus: bus(par(datos, "rx_bus", r)),
      q_mvar: num(par(datos, "rx_q_mvar", r)),
      costo: num(par(datos, "rx_cost_musd", r)),
    })),
    // Angle-difference limits of the case (90 degrees and atan(100) when they are absent).
    theta_max_deg: radADeg(num(escalar(datos, "theta_max_rad"), 1.5708)),
    dtheta_max_deg: radADeg(Math.atan(num(escalar(datos, "tan_amax"), 100.0))),
    refbus: bus(escalar(datos, "refbus")),
    barras,
    ac_existentes: acExist,
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
    sitios,
  };
  if (sitiosError !== "") salida.sitios_error = sitiosError;
  return neutro(salida) as Dict;
}

// Julia's rad2deg: radians times 180/pi.
function radADeg(x: number): number {
  return x * (180 / Math.PI);
}
