// Red de un caso del almacen para GET /api/red: port de la parte de `construir_red` (xpand src/servidor.jl, 3647-3809)
// que hace falta con tec=ac y para los campos de contracts/api/red.schema.json. Los numeros los pone el lector de
// @xpand/core (paridad exacta con Red.red_* de XpandCore, decision D1 de la 003); aqui solo se elige que ficheros
// leer, se aplica el filtro de tecnologia y se anaden motor/sistema/nombre_sistema, como en xpand.
//
// Se porta:
// - Despacho por `motor.esquema_red`: real -> red_real(«red»), hidro -> red_hidro(«base»), matpower CON fichero «m»
//   -> red_matpower(«m»), gfmgfl -> red_gfmgfl(base + horizonte), lo demas -> red_misocp. El esquema matpower SIN .m
//   (fp_dc) va por red_misocp, como en xpand: el .m de esos motores lo escribe la interfaz al lanzar la corrida.
// - Ficheros de red_misocp con tec=ac: base + ac + extra (overlays econ/tighten), en ese orden.
// - Filtro por tecnologia (vaciar lo no pedido y anotarlo en `tec_filtradas`) salvo con esquema matpower, igual que
//   xpand (la condicion mira el esquema del motor, no la via de lectura).
// - De `_pegar_geografia!` solo los `nombres` de geo.json (etiqueta y nombre de la barra, campos del contrato).
//
// No se porta (no son campos del contrato o no aplican con tec=ac):
// - Tecnologias distintas de ac (hvdc, bancos, statcom, sssc, tcsc, svc, bess, ibr, gen/genexp y el `menu`), y
//   `todos_candidatos` (exportacion del .m).
// - `_aplicar_coords!` (coords.json: px/py, trazado_disenado, trayectos_disenados, trafo_dibujo; tambien el trazado
//   compartido por familia), `_reserva_del_caso` (`reserva`), `_mbase_desde_m!` (mbase de los generadores),
//   `avisos_hash_tablas` (`avisos_datos`), `_marcar_estrellas!` (estrella) y de geo.json todo menos los nombres
//   (lon/lat, rutas, grupos, sitios, redes, fuentes, el contador `geografia`).
//
// Ademas de xpand (xpand lee estos casos sin queja y sirve una red parcial): un fichero declarado en `archivos` y
// necesario para esta red que no se puede leer, o un .dat que acaba a mitad de una sentencia (sin «;» final), da
// LectorError en vez de una red incompleta. Ningun mensaje lleva rutas del disco: solo el nombre relativo del fichero.
import { redGfmgfl, redHidro, redMatpower, redMisocp, redReal, type Leer } from "@xpand/core";
import type { Red } from "@xpand/api/red-wire";
import type { Caso } from "./almacen";

export type Tec = "ac";

/** El lector no pudo construir la red de un caso. `message` no lleva rutas absolutas. */
export class LectorError extends Error {
  readonly codigo = "lector_fallo";

  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "LectorError";
  }
}

type Dict = Record<string, unknown>;

// Raiz virtual de las rutas que ve el lector: red_misocp exige que el base acabe en «/base.dat» y lee junto a el
// (econ.dat, dinamica.dat, ...) con dirname/joinpath.
const RAIZ = "/caso/";

// Listas que el filtro vacia cuando su tecnologia no esta pedida (orden de xpand, que es el de `tec_filtradas`).
const FILTRO_TEC: readonly (readonly [string, readonly string[]])[] = [
  ["bancos", ["bancos"]],
  ["statcom", ["statcom"]],
  ["sssc", ["sssc"]],
  ["tcsc", ["tcsc"]],
  ["svc", ["svc"]],
  ["bess", ["bess"]],
  ["ibr", ["ibr"]],
];

/** Texto tras el ultimo «;» una vez quitados los comentarios «#» por linea (misma regla que el lector AMPL). */
function sentenciaSinCerrar(texto: string): boolean {
  const sinComentarios = texto
    .split("\n")
    .map((l) => {
      const i = l.indexOf("#");
      return i === -1 ? l : l.slice(0, i);
    })
    .join("\n");
  const cola = sinComentarios.slice(sinComentarios.lastIndexOf(";") + 1);
  return cola.trim() !== "";
}

/** Lee los ficheros declarados que necesita esta red; falla si falta alguno o si un .dat esta truncado. */
function leerDeclarados(caso: Caso, nombres: readonly string[]): Map<string, string> {
  const textos = new Map<string, string>();
  for (const nombre of nombres) {
    const texto = caso.leer(nombre);
    if (texto === undefined) throw new LectorError(`${nombre}: el fichero declarado en el caso no se puede leer`);
    if (nombre.toLowerCase().endsWith(".dat") && sentenciaSinCerrar(texto)) {
      throw new LectorError(`${nombre}: el fichero acaba a mitad de una sentencia (falta el «;» final)`);
    }
    textos.set(RAIZ + nombre, texto);
  }
  return textos;
}

function lectorVirtual(caso: Caso, declarados: ReadonlyMap<string, string>): Leer {
  return (ruta) => {
    if (!ruta.startsWith(RAIZ)) return undefined;
    return declarados.get(ruta) ?? caso.leer(ruta.slice(RAIZ.length));
  };
}

function primero(caso: Caso, clave: string): string {
  const nombre = caso.ruta(clave)[0];
  if (nombre === undefined) throw new LectorError(`el caso no declara el fichero «${clave}» que su esquema necesita`);
  return nombre;
}

/** Ficheros a leer y lector a llamar segun el esquema (la cadena if/elseif de construir_red). */
function leerSegunEsquema(caso: Caso, esquema: string, tecs: ReadonlySet<string>): Dict {
  const con = (nombres: string[], lector: (rutas: string[], leer: Leer) => Dict): Dict => {
    const declarados = leerDeclarados(caso, nombres);
    return lector(nombres.map((n) => RAIZ + n), lectorVirtual(caso, declarados));
  };
  // Lectores de un solo fichero: el primero de la clave (`first(lista(k))` en xpand).
  const uno = (clave: string, lector: (ruta: string, leer: Leer) => Dict): Dict => {
    const nombre = primero(caso, clave);
    return con([nombre], (_rutas, leer) => lector(RAIZ + nombre, leer));
  };
  if (esquema === "real") return uno("red", (r, leer) => redReal(leer(r) ?? ""));
  if (esquema === "hidro") return uno("base", redHidro);
  if (esquema === "matpower" && caso.ruta("m").length > 0) return uno("m", (r, leer) => redMatpower(leer(r) ?? ""));
  if (esquema === "gfmgfl") return con([...caso.ruta("base"), ...caso.ruta("horizonte")], redGfmgfl);
  const nombres = [...caso.ruta("base"), ...(tecs.has("ac") ? caso.ruta("ac") : []), ...caso.ruta("extra")];
  return con(nombres, redMisocp);
}

/** `vaciar!` de construir_red: listas de tecnologias no pedidas, vacias y anotadas en `tec_filtradas`. */
function filtrarTecnologias(red: Dict, tecs: ReadonlySet<string>): Dict {
  const filtradas: string[] = [];
  for (const [tec, claves] of FILTRO_TEC) if (!tecs.has(tec)) filtradas.push(...claves);
  if (!tecs.has("gen") && !tecs.has("genexp")) filtradas.push("proyectos_gen");
  if (!tecs.has("hvdc")) filtradas.push("ramas_dc", "convertidores", ...(Object.hasOwn(red, "nodos_dc") ? ["nodos_dc"] : []));
  if (!tecs.has("ac")) filtradas.push("ac_candidatos");
  return { ...red, ...Object.fromEntries(filtradas.map((k) => [k, []])), tec_filtradas: filtradas };
}

/** Directorios (relativos) de los ficheros declarados, sin repetir y en el orden del manifiesto. */
function directoriosDelCaso(caso: Caso): string[] {
  const dirs = Object.keys(caso.manifiesto.archivos).flatMap((clave) =>
    caso.ruta(clave).map((n) => (n.includes("/") ? n.slice(0, n.lastIndexOf("/") + 1) : "")),
  );
  return [...new Set(dirs)];
}

/** Los `nombres` del primer geo.json legible junto a los ficheros del caso (id de barra -> nombre). */
function nombresGeo(caso: Caso): Record<string, unknown> {
  for (const dir of directoriosDelCaso(caso)) {
    const texto = caso.leer(`${dir}geo.json`);
    if (texto === undefined) continue;
    let geo: unknown;
    try {
      geo = JSON.parse(texto);
    } catch {
      continue; // xpand: un geo.json ilegible se ignora y se prueba el siguiente
    }
    if (geo === null || typeof geo !== "object" || Array.isArray(geo)) return {};
    const nombres = (geo as Dict).nombres;
    return nombres !== null && typeof nombres === "object" && !Array.isArray(nombres) ? (nombres as Record<string, unknown>) : {};
  }
  return {};
}

function conNombres(red: Dict, nombres: Record<string, unknown>): Dict {
  if (!Array.isArray(red.barras)) return red;
  const barras = (red.barras as Dict[]).map((b) => {
    const nm = nombres[String(b.id)];
    return typeof nm === "string" && nm !== "" ? { ...b, etiqueta: nm, nombre: nm } : b;
  });
  return { ...red, barras };
}

/**
 * Red del caso con las tecnologias `tec` (en M0 solo «ac»), en la forma neutra de @xpand/core: los campos de
 * contracts/api/red.schema.json mas los que el lector emite. Lanza LectorError si no se puede construir.
 */
export function construirRed(caso: Caso, tec: Tec): Red {
  const tecs = new Set([tec]);
  const { motor, sistema } = caso.manifiesto;
  let red: Dict;
  try {
    red = leerSegunEsquema(caso, motor.esquema_red, tecs);
  } catch (e) {
    if (e instanceof LectorError) throw e;
    throw new LectorError("el lector no pudo construir la red del caso", { cause: e });
  }
  if (motor.esquema_red !== "matpower") red = filtrarTecnologias(red, tecs);
  red = { ...conNombres(red, nombresGeo(caso)), motor: motor.id, sistema: sistema.id, nombre_sistema: sistema.nombre };
  for (const k of ["barras", "ac_existentes", "ac_candidatos"]) {
    if (!Array.isArray(red[k])) throw new LectorError(`la red construida no trae «${k}»`);
  }
  return red as unknown as Red;
}
