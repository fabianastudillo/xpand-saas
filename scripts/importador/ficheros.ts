// Ficheros de un caso: los declarados en `archivos` y los que el lector abre junto al base sin estar declarados.
// Todos se resuelven con realpath y tienen que quedar dentro del checkout de xpand (ni «..» ni enlaces simbolicos
// sacan de el); el nombre en el almacen es el nombre declarado, sin carpetas.
import { lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { esNombreArchivoValido, MAX_BYTES_FICHERO } from "@xpand/casos";
import { FICHEROS_JUNTO_AL_BASE } from "@xpand/core";

export const NOMBRE_MANIFIESTO = "manifiesto.json";
/** Leidos por xpand junto a los ficheros del caso: geo.json en la carpeta de cualquier declarado, coords.json junto al base. */
const GEO = "geo.json";
const COORDS = "coords.json";

export class FicheroNoValido extends Error {}

export function dentroDe(raiz: string, destino: string): boolean {
  return destino.startsWith(raiz + path.sep);
}

/** Ruta real de un fichero regular dentro del checkout; lanza FicheroNoValido si no lo es. */
export function resolverEnCheckout(checkoutReal: string, ruta: string): string {
  let real: string;
  try {
    real = realpathSync(ruta);
  } catch {
    throw new FicheroNoValido("no existe o no se puede resolver");
  }
  if (!dentroDe(checkoutReal, real)) throw new FicheroNoValido("cae fuera del checkout");
  const st = statSync(real);
  if (!st.isFile()) throw new FicheroNoValido("no es un fichero regular");
  if (st.size > MAX_BYTES_FICHERO) throw new FicheroNoValido("supera el tamano maximo");
  return real;
}

function existe(ruta: string): boolean {
  try {
    lstatSync(ruta);
    return true;
  } catch {
    return false;
  }
}

/** Nombre en el almacen -> ruta real de origen. Lanza FicheroNoValido ante un nombre repetido con otro origen. */
export class Copias {
  readonly porNombre = new Map<string, string>();

  anadir(nombre: string, real: string): void {
    if (!esNombreArchivoValido(nombre) || nombre === NOMBRE_MANIFIESTO) throw new FicheroNoValido("nombre no permitido");
    const previo = this.porNombre.get(nombre);
    if (previo !== undefined && previo !== real) throw new FicheroNoValido("dos ficheros distintos con el mismo nombre");
    this.porNombre.set(nombre, real);
  }
}

/**
 * Anade a `copias` los ficheros sin declarar que el lector abre: las tablas de FICHEROS_JUNTO_AL_BASE y coords.json
 * junto al primer base, y el primer geo.json de las carpetas de los declarados (en su orden). Solo los que existen.
 */
export function anadirVecinos(checkoutReal: string, dirBase: string, dirsDeclarados: readonly string[], copias: Copias): void {
  for (const nombre of [...FICHEROS_JUNTO_AL_BASE, COORDS]) {
    const ruta = path.join(dirBase, nombre);
    // Si ya se declaro un fichero con ese nombre desde otra carpeta, anadir() lanza: el almacen no podria tener los dos.
    if (existe(ruta)) copias.anadir(nombre, resolverEnCheckout(checkoutReal, ruta));
  }
  if (copias.porNombre.has(GEO)) return;
  for (const dir of dirsDeclarados) {
    const ruta = path.join(dir, GEO);
    if (existe(ruta)) {
      copias.anadir(GEO, resolverEnCheckout(checkoutReal, ruta));
      return;
    }
  }
}
