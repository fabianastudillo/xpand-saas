// Lista blanca de casos publicos (config/casos-publicos.json). Un sistema solo es `publico` si su id y la carpeta de
// sus datos en el checkout de xpand figuran aqui; todo lo demas es `interno`. Cada entrada declara su fuente publica.
import { esIdValido, esNombreArchivoValido } from "@xpand/casos";

/**
 * Nombres que delatan datos del SNI, CENACE, CELEC o SDDP. Un caso cuyos metadatos o rutas los contienen nunca se
 * importa como publico, aunque figure en la lista; y la lista misma no puede contenerlos.
 */
export const PATRON_INTERNO = /ecuador|sni|sddp|cenace|celec/i;

/** Un DOI (10.NNNN/...) o una URL http(s): la fuente publica tiene que poder comprobarse. */
const REFERENCIA_VERIFICABLE = /\b10\.\d{4,9}\/\S+|https?:\/\/\S+/;

export interface EntradaLista {
  /** Id del sistema en el catalogo de xpand (el mismo en todos los motores que lo ofrecen). */
  readonly sistema: string;
  /** Carpeta de sus datos, relativa a la raiz del checkout (la del primer fichero `base`). */
  readonly datos: string;
  /** Fuente publica de los datos, con al menos un DOI o URL. */
  readonly fuente: string;
  /** Motores en los que la entrada aplica; sin él, en todos los que ofrezcan ese sistema con esa carpeta. */
  readonly motores?: readonly string[];
}

export interface ListaBlanca {
  readonly sistemas: readonly EntradaLista[];
}

function entrada(valor: unknown, i: number, exigirFuenteVerificable: boolean): EntradaLista {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) throw new Error(`entrada ${String(i)}: no es un objeto`);
  const { sistema, datos, fuente, motores } = valor as Record<string, unknown>;
  if (typeof sistema !== "string" || !esIdValido(sistema)) throw new Error(`entrada ${String(i)}: «sistema» no es un id valido`);
  if (typeof datos !== "string" || !esNombreArchivoValido(datos) || datos.split("/").includes(".")) {
    throw new Error(`entrada ${String(i)} (${sistema}): «datos» debe ser una ruta relativa al checkout, sin «..» ni «.»`);
  }
  if (typeof fuente !== "string" || fuente.trim() === "") throw new Error(`entrada ${String(i)} (${sistema}): falta la «fuente» publica`);
  if (exigirFuenteVerificable && !REFERENCIA_VERIFICABLE.test(fuente)) {
    throw new Error(`entrada ${String(i)} (${sistema}): la «fuente» tiene que citar un DOI o URL verificable`);
  }
  if (motores !== undefined && (!Array.isArray(motores) || !motores.every((m) => typeof m === "string" && esIdValido(m)))) {
    throw new Error(`entrada ${String(i)} (${sistema}): «motores» debe ser una lista de ids de motor`);
  }
  return { sistema, datos, fuente, ...(motores === undefined ? {} : { motores: motores as string[] }) };
}

/**
 * Lee y valida la lista blanca. Lanza si la forma es incorrecta o si nombra datos internos. `exigirFuenteVerificable`
 * (por defecto) exige un DOI o URL en cada «fuente»; solo lo relaja quien lee una lista de prueba, nunca la de producción.
 */
export function leerListaBlanca(texto: string, opciones: { readonly exigirFuenteVerificable?: boolean } = {}): ListaBlanca {
  if (PATRON_INTERNO.test(texto)) throw new Error("la lista blanca contiene un patron de datos internos (ecuador, sni, sddp, cenace, celec)");
  const json: unknown = JSON.parse(texto);
  const lista = json !== null && typeof json === "object" ? (json as Record<string, unknown>).sistemas : undefined;
  if (!Array.isArray(lista)) throw new Error("la lista blanca no tiene un array «sistemas»");
  const sistemas = lista.map((valor, i) => entrada(valor, i, opciones.exigirFuenteVerificable ?? true));
  const vistas = new Set<string>();
  for (const e of sistemas) {
    const clave = `${e.sistema}\0${e.datos}`;
    if (vistas.has(clave)) throw new Error(`entrada repetida: ${e.sistema} (${e.datos})`);
    vistas.add(clave);
  }
  return { sistemas };
}

/** La entrada de la lista para ese sistema con esos datos en ese motor, o undefined. */
export function buscarEnLista(lista: ListaBlanca, sistema: string, datos: string, motor: string | undefined): EntradaLista | undefined {
  return lista.sistemas.find(
    (e) => e.sistema === sistema && e.datos === datos && (e.motores === undefined || (motor !== undefined && e.motores.includes(motor))),
  );
}
