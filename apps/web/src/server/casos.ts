// Instancia del almacen de casos de la app y sus caches en memoria (solo Node).
//
// - El almacen se abre en la primera peticion y se relee (`recargar()`) cuando han pasado mas de XPAND_ALMACEN_TTL_S
//   segundos (30 por defecto) desde la ultima carga: retirar o cambiar un caso surte efecto sin reiniciar (R12).
// - No se guardan objetos Caso entre peticiones (llevan el manifiesto de su carga): cada peticion los pide al almacen.
// - Se guardan el catalogo, las redes ya construidas (motor/sistema/tec) y los fallos del lector (cache negativa
//   acotada: un caso roto se lee y se registra una vez por carga, no en cada peticion); todo se tira al releer.
// - Si la relectura falla (devuelve false o lanza) se sigue sirviendo la foto anterior y el siguiente intento espera
//   el TTL, luego el doble, ... hasta 5 min; al ir bien vuelve al TTL. Sin foto anterior (el almacen no se pudo
//   abrir) las rutas responden 503 almacen_no_disponible.
// - `detalles` (rutas, ids, motivos) va al registro del servidor una vez por carga; nunca a una respuesta.
// - En M0 los casos `interno` no se sirven nunca: todo se pide con incluirInternos false.
import os from "node:os";
import path from "node:path";
import {
  abrirAlmacen,
  CAMPOS_MOTOR_PUBLICOS,
  CAMPOS_REFERENCIA_PUBLICOS,
  CAMPOS_SISTEMA_PUBLICOS,
  construirRed,
  LectorError,
  soloCampos,
  type Almacen,
  type Manifiesto,
  type Tec,
} from "@xpand/casos";
import type { Catalogo, Motor, RedWire, Referencia, Sistema } from "@xpand/api";

const TTL_POR_DEFECTO_S = 30;
const MS_POR_S = 1000;
const SIN_INTERNOS = { incluirInternos: false } as const;
const ESPERA_MAXIMA_MS = 5 * 60 * MS_POR_S;
/** Tope de fallos del lector guardados por carga (las claves solo pueden ser casos publicos existentes). */
const MAX_FALLOS_EN_CACHE = 256;

/** El almacen no se pudo abrir y no hay foto anterior que servir. Sin la causa en el mensaje. */
export class AlmacenNoDisponible extends Error {
  readonly codigo = "almacen_no_disponible";

  constructor(opciones?: { cause?: unknown }) {
    super("El almacén de casos no está disponible.", opciones);
    this.name = "AlmacenNoDisponible";
  }
}

interface Estado {
  readonly almacen: Almacen;
  readonly cargadoEn: number;
  readonly catalogo: Catalogo;
  readonly redes: Map<string, RedWire>;
  readonly fallos: Map<string, LectorError>;
}

let estado: Estado | undefined;
let cargaEnCurso: Promise<Estado> | undefined;
let fallosSeguidos = 0;
let proximoIntento = 0;

export function dirAlmacen(env: NodeJS.ProcessEnv = process.env): string {
  return env.XPAND_ALMACEN?.trim() || path.join(os.homedir(), ".xpand-saas", "almacen");
}

function ttlMs(env: NodeJS.ProcessEnv = process.env): number {
  const texto = env.XPAND_ALMACEN_TTL_S?.trim();
  const s = texto ? Number(texto) : NaN;
  return (Number.isFinite(s) && s >= 0 ? s : TTL_POR_DEFECTO_S) * MS_POR_S;
}

function esReferencia(r: unknown): r is Referencia {
  return r !== null && typeof r === "object" && typeof (r as { valor?: unknown }).valor === "number";
}

/**
 * Sistema del catalogo desde su manifiesto, con solo los campos publicos (CAMPOS_SISTEMA_PUBLICOS; el importador ya
 * escribe solo esos, pero un manifiesto escrito a mano podria traer rutas). El esquema del manifiesto no valida
 * `referencias`; el contrato exige un `valor` numerico en cada una: las que no lo traen se quitan y se registran.
 */
function sistemaDelCatalogo(motorId: string, sistema: Manifiesto["sistema"]): Sistema {
  const { referencias, ...resto } = soloCampos(sistema, CAMPOS_SISTEMA_PUBLICOS) as Manifiesto["sistema"];
  if (referencias === undefined) return { ...resto };
  const validas = referencias.filter(esReferencia).map((r) => soloCampos(r, CAMPOS_REFERENCIA_PUBLICOS) as Referencia);
  if (validas.length < referencias.length) {
    console.warn(
      `[almacen de casos] ${motorId}/${sistema.id}: ${String(referencias.length - validas.length)} referencias sin valor numerico; no se sirven`,
    );
  }
  return { ...resto, referencias: validas };
}

/** Catalogo agrupado por motor desde los manifiestos, en el orden del almacen (motor y sistema por id). */
function construirCatalogo(almacen: Almacen): Catalogo {
  const motores = new Map<string, Motor>();
  for (const caso of almacen.casos(SIN_INTERNOS)) {
    const { motor, sistema } = caso.manifiesto;
    const previo = motores.get(motor.id) ?? { ...(soloCampos(motor, CAMPOS_MOTOR_PUBLICOS) as Manifiesto["motor"]), sistemas: [] };
    motores.set(motor.id, { ...previo, sistemas: [...previo.sistemas, sistemaDelCatalogo(motor.id, sistema)] });
  }
  const aviso = almacen.aviso;
  return { motores: [...motores.values()], ...(aviso === undefined ? {} : { aviso }) };
}

function registrarDetalles(almacen: Almacen): void {
  const detalles = almacen.detalles;
  if (detalles.length === 0) return;
  console.warn(`[almacen de casos] ${String(detalles.length)} avisos:\n${detalles.join("\n")}`);
}

class RelecturaFallida extends Error {}

function estadoNuevo(almacen: Almacen): Estado {
  return { almacen, cargadoEn: Date.now(), catalogo: construirCatalogo(almacen), redes: new Map(), fallos: new Map() };
}

async function cargar(previo: Estado | undefined): Promise<Estado> {
  const almacen = previo?.almacen ?? (await abrirAlmacen(dirAlmacen()));
  const bien = previo ? await almacen.recargar() : true;
  registrarDetalles(almacen);
  if (!bien) throw new RelecturaFallida("la relectura del almacen fallo (motivo en los avisos)");
  return estadoNuevo(almacen);
}

/** Espera tras `n` fallos seguidos: TTL, 2·TTL, 4·TTL, ... (al menos 1 s) hasta ESPERA_MAXIMA_MS. */
function esperaTrasFallos(n: number): number {
  return Math.min(Math.max(ttlMs(), MS_POR_S) * 2 ** (n - 1), ESPERA_MAXIMA_MS);
}

function anotarFallo(e: unknown): Estado {
  fallosSeguidos += 1;
  const espera = esperaTrasFallos(fallosSeguidos);
  proximoIntento = Date.now() + espera;
  const motivo = e instanceof Error ? e.message : String(e);
  console.warn(
    `[almacen de casos] ${estado ? "relectura" : "apertura"} fallida (${String(fallosSeguidos)} seguidas): ${motivo}; ` +
      `${estado ? "se sirve la foto anterior; " : ""}proximo intento en ${String(espera / MS_POR_S)} s`,
  );
  if (estado) return estado;
  throw new AlmacenNoDisponible({ cause: e });
}

/**
 * El estado vigente: lo abre la primera vez y lo relee pasado el TTL (o la espera tras un fallo). Una sola carga a
 * la vez. Lanza AlmacenNoDisponible solo si nunca se pudo abrir.
 */
async function vigente(): Promise<Estado> {
  if (cargaEnCurso) return cargaEnCurso;
  const ahora = Date.now();
  if (estado && ahora - estado.cargadoEn <= ttlMs()) return estado;
  if (ahora < proximoIntento) {
    if (estado) return estado;
    throw new AlmacenNoDisponible();
  }
  cargaEnCurso = cargar(estado)
    .then((nuevo) => {
      estado = nuevo;
      fallosSeguidos = 0;
      proximoIntento = 0;
      return nuevo;
    }, anotarFallo)
    .finally(() => {
      cargaEnCurso = undefined;
    });
  return cargaEnCurso;
}

export async function catalogoVigente(): Promise<Catalogo> {
  return (await vigente()).catalogo;
}

/**
 * Red de un caso publico, o undefined si no existe, es interno o los ids no son validos (indistinguibles a
 * proposito). Lanza LectorError si el lector no la puede construir (registrado una vez por carga) y
 * AlmacenNoDisponible si el almacen nunca se pudo abrir.
 */
export async function redVigente(motor: string, sistema: string, tec: Tec): Promise<RedWire | undefined> {
  const { almacen, redes, fallos } = await vigente();
  const caso = almacen.caso(motor, sistema, SIN_INTERNOS);
  if (!caso) return undefined;
  // Los ids validos no llevan «/» (patron del almacen): la clave no es ambigua.
  const clave = `${motor}/${sistema}/${tec}`;
  const enCache = redes.get(clave);
  if (enCache) return enCache;
  const fallo = fallos.get(clave);
  if (fallo) throw fallo;
  try {
    const red = construirRed(caso, tec);
    redes.set(clave, red);
    return red;
  } catch (e) {
    if (e instanceof LectorError) {
      console.error(`[api/red] ${clave}: ${e.message}`, e.cause ?? "");
      if (fallos.size < MAX_FALLOS_EN_CACHE) fallos.set(clave, e);
    }
    throw e;
  }
}

/** Olvida el almacen, las caches y la espera tras fallos (pruebas: cambiar XPAND_ALMACEN entre casos). */
export function reiniciarAlmacenParaPruebas(): void {
  estado = undefined;
  cargaEnCurso = undefined;
  fallosSeguidos = 0;
  proximoIntento = 0;
}
