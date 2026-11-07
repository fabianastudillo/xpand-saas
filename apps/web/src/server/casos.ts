// Instancia del almacen de casos de la app y sus caches en memoria (solo Node).
//
// - El almacen se abre en la primera peticion y se relee (`recargar()`) cuando han pasado mas de XPAND_ALMACEN_TTL_S
//   segundos (30 por defecto) desde la ultima carga: retirar o cambiar un caso surte efecto sin reiniciar (R12).
// - No se guardan objetos Caso entre peticiones (llevan el manifiesto de su carga): cada peticion los pide al almacen.
// - Se guardan el catalogo y las redes ya construidas (motor/sistema/tec); ambos se tiran en cada relectura. Un fallo
//   del lector no se guarda: la siguiente peticion lo vuelve a intentar.
// - `detalles` (rutas, ids, motivos) va al registro del servidor una vez por carga; nunca a una respuesta.
// - En M0 los casos `interno` no se sirven nunca: todo se pide con incluirInternos false.
import os from "node:os";
import path from "node:path";
import { abrirAlmacen, construirRed, type Almacen, type Manifiesto, type Tec } from "@xpand/casos";
import type { Catalogo, Motor, RedWire, Referencia, Sistema } from "@xpand/api";

const TTL_POR_DEFECTO_S = 30;
const MS_POR_S = 1000;
const SIN_INTERNOS = { incluirInternos: false } as const;

interface Estado {
  readonly almacen: Almacen;
  readonly cargadoEn: number;
  readonly catalogo: Catalogo;
  readonly redes: Map<string, RedWire>;
}

let estado: Estado | undefined;
let cargaEnCurso: Promise<Estado> | undefined;

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
 * Sistema del catalogo desde su manifiesto. El esquema del manifiesto no valida `referencias`; el contrato exige un
 * `valor` numerico en cada una: las que no lo traen se quitan y se registran (el resto del sistema se sirve).
 */
function sistemaDelCatalogo(motorId: string, sistema: Manifiesto["sistema"]): Sistema {
  const { referencias, ...resto } = sistema;
  if (referencias === undefined) return { ...resto };
  const validas = referencias.filter(esReferencia);
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
    const previo = motores.get(motor.id) ?? { ...motor, sistemas: [] };
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

async function cargar(previo: Estado | undefined): Promise<Estado> {
  const almacen = previo?.almacen ?? (await abrirAlmacen(dirAlmacen()));
  if (previo) await almacen.recargar();
  registrarDetalles(almacen);
  return { almacen, cargadoEn: Date.now(), catalogo: construirCatalogo(almacen), redes: new Map() };
}

/** El estado vigente: lo abre la primera vez y lo relee pasado el TTL. Una sola carga a la vez. */
async function vigente(): Promise<Estado> {
  if (cargaEnCurso) return cargaEnCurso;
  if (estado && Date.now() - estado.cargadoEn <= ttlMs()) return estado;
  cargaEnCurso = cargar(estado)
    .then((nuevo) => {
      estado = nuevo;
      return nuevo;
    })
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
 * proposito). Lanza LectorError si el lector no la puede construir.
 */
export async function redVigente(motor: string, sistema: string, tec: Tec): Promise<RedWire | undefined> {
  const { almacen, redes } = await vigente();
  const caso = almacen.caso(motor, sistema, SIN_INTERNOS);
  if (!caso) return undefined;
  // Los ids validos no llevan «/» (patron del almacen): la clave no es ambigua.
  const clave = `${motor}/${sistema}/${tec}`;
  const enCache = redes.get(clave);
  if (enCache) return enCache;
  const red = construirRed(caso, tec);
  redes.set(clave, red);
  return red;
}

/** Olvida el almacen y las caches (pruebas: cambiar XPAND_ALMACEN entre casos). */
export function reiniciarAlmacenParaPruebas(): void {
  estado = undefined;
  cargaEnCurso = undefined;
}
