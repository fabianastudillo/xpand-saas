// pnpm comparar-con-xpand --xpand-url <url> --plataforma-url <url> [--guardar-esperado <dir>]
//
// Compara, campo a campo y con igualdad exacta, la red que sirve /api/red de la plataforma con la de un servidor
// xpand en marcha (solo lectura: GET a /api/catalogo y /api/red con tec=ac). Solo se comparan casos públicos: los que
// sirve la plataforma y los de config/casos-publicos.json que xpand tiene (con la misma carpeta de datos que usa el
// importador). Un caso interno de xpand no se pide a la plataforma ni se nombra. Solo se comparan los campos del
// contrato (contracts/api/red.schema.json); ids y `de`/`a` se pasan a cadena en ambos lados.
//
// Códigos de salida: 0 sin diferencias, 1 con diferencias, 64 uso incorrecto o servidor inalcanzable.
// Con --guardar-esperado escribe <dir>/<motor>/<sistema>/esperado-red.json (la red de xpand, en el contrato) de cada
// caso público que sirve la plataforma; es la referencia de packages/casos/src/red.test.ts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { esIdValido } from "@xpand/casos";
import { ficheroPrincipal } from "./importador/metadatos";
import { leerListaBlanca, type ListaBlanca } from "./importador/lista-blanca";

const CODIGO_OK = 0;
const CODIGO_DIFERENCIAS = 1;
const CODIGO_USO = 64;
const TEC = "ac";
const TIMEOUT_CATALOGO_MS = 30_000;
// Una red grande (IEEE-118) puede tardar en la primera petición, cuando el servidor de desarrollo compila.
const TIMEOUT_RED_MS = 120_000;

const RUTA_LISTA_BLANCA = fileURLToPath(new URL("../config/casos-publicos.json", import.meta.url));
const RUTA_SCHEMA_RED = fileURLToPath(new URL("../contracts/api/red.schema.json", import.meta.url));

type Coleccion = "barras" | "ac_existentes" | "ac_candidatos";
/** Colección de la red → definición de su registro en red.schema.json. */
const COLECCIONES: readonly (readonly [Coleccion, string])[] = [
  ["barras", "barra"],
  ["ac_existentes", "lineaExistente"],
  ["ac_candidatos", "lineaCandidata"],
];
/** Campos cuyo valor puede llegar como entero (idBarra en el contrato); se pasan a cadena en ambos lados. */
const CAMPOS_DE_BARRA = new Set(["id", "de", "a"]);

/** Campos del contrato por colección, leídos del schema (no una lista a mano). */
function camposDelContrato(): Record<Coleccion, readonly string[]> {
  const schema = JSON.parse(readFileSync(RUTA_SCHEMA_RED, "utf8")) as {
    definitions: Record<string, { properties: Record<string, unknown> }>;
  };
  const campos = {} as Record<Coleccion, readonly string[]>;
  for (const [coleccion, definicion] of COLECCIONES) {
    const propiedades = schema.definitions[definicion]?.properties;
    if (propiedades === undefined) throw new Error(`red.schema.json no define «${definicion}»`);
    campos[coleccion] = Object.keys(propiedades);
  }
  return campos;
}
const CAMPOS = camposDelContrato();

export type Proyeccion = Record<Coleccion, Record<string, unknown>[]>;
export interface Par {
  readonly motor: string;
  readonly sistema: string;
}
export interface Diferencia extends Par {
  readonly ruta: string;
  readonly xpand: string;
  readonly plataforma: string;
}
export interface Esperado extends Par {
  readonly red: Proyeccion;
}
export interface Resultado {
  readonly casos: number;
  readonly diferencias: Diferencia[];
  readonly esperados: Esperado[];
}
export interface Salida {
  readonly codigo: number;
  readonly texto: string;
}
export interface OpcionesEjecutar {
  /** Lista blanca; por defecto, config/casos-publicos.json. */
  readonly listaBlanca?: ListaBlanca;
}

/** Uso incorrecto o servidor que no responde: el comparador no puede dar un resultado (código 64). */
export class ErrorComparacion extends Error {}

interface RespuestaApi {
  readonly estado: number;
  readonly cuerpo: unknown;
}

// ---------- Proyección y comparación de redes ----------

const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Una red con los campos del contrato y los ids como cadena. Exige la forma (arrays de objetos) antes. */
export function proyectarRed(red: Record<string, unknown>): Proyeccion {
  const proyeccion = {} as Proyeccion;
  for (const [coleccion] of COLECCIONES) {
    proyeccion[coleccion] = (red[coleccion] as Record<string, unknown>[]).map((registro) => proyectarRegistro(registro, CAMPOS[coleccion]));
  }
  return proyeccion;
}

function proyectarRegistro(registro: Record<string, unknown>, campos: readonly string[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const campo of campos) {
    const valor = registro[campo];
    if (valor === undefined) continue;
    salida[campo] = CAMPOS_DE_BARRA.has(campo) && typeof valor === "number" ? String(valor) : valor;
  }
  return salida;
}

function esRedValida(cuerpo: unknown): cuerpo is Record<string, unknown> {
  return esObjeto(cuerpo) && COLECCIONES.every(([coleccion]) => {
    const lista = cuerpo[coleccion];
    return Array.isArray(lista) && lista.every(esObjeto);
  });
}

interface Hallazgo {
  readonly ruta: string;
  readonly xpand: string;
  readonly plataforma: string;
}

const formatear = (valor: unknown): string => (valor === undefined ? "(ausente)" : JSON.stringify(valor));

function compararValores(xpand: unknown, plataforma: unknown, ruta: string, hallazgos: Hallazgo[]): void {
  if (Array.isArray(xpand) && Array.isArray(plataforma)) {
    if (xpand.length !== plataforma.length) {
      hallazgos.push({ ruta, xpand: `${String(xpand.length)} elementos`, plataforma: `${String(plataforma.length)} elementos` });
    }
    const comunes = Math.min(xpand.length, plataforma.length);
    for (let i = 0; i < comunes; i++) compararValores(xpand[i], plataforma[i], `${ruta}[${String(i)}]`, hallazgos);
    return;
  }
  if (esObjeto(xpand) && esObjeto(plataforma)) {
    for (const clave of new Set([...Object.keys(xpand), ...Object.keys(plataforma)])) {
      const subruta = ruta === "" ? clave : `${ruta}.${clave}`;
      compararValores(xpand[clave], plataforma[clave], subruta, hallazgos);
    }
    return;
  }
  if (xpand !== plataforma) hallazgos.push({ ruta, xpand: formatear(xpand), plataforma: formatear(plataforma) });
}

/** Diferencias entre dos proyecciones, con la ruta JSON del lado de xpand (p. ej. `barras[1].pd`). */
export function diferenciasRed(xpand: Proyeccion, plataforma: Proyeccion): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  compararValores(xpand, plataforma, "", hallazgos);
  return hallazgos;
}

// ---------- Peticiones ----------

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

async function pedir(url: string, timeoutMs: number): Promise<RespuestaApi> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (causa) {
    const motivo = causa instanceof Error ? causa.message : String(causa);
    throw new ErrorComparacion(`no responde ${new URL(url).origin} (${motivo})`);
  }
  const texto = await respuesta.text();
  try {
    return { estado: respuesta.status, cuerpo: JSON.parse(texto) as unknown };
  } catch {
    return { estado: respuesta.status, cuerpo: undefined };
  }
}

async function pedirCatalogo(base: string): Promise<unknown> {
  const respuesta = await pedir(`${sinBarraFinal(base)}/api/catalogo`, TIMEOUT_CATALOGO_MS);
  if (respuesta.estado !== 200 || !esObjeto(respuesta.cuerpo) || !Array.isArray(respuesta.cuerpo.motores)) {
    throw new ErrorComparacion(`${new URL(base).origin} no sirve un catálogo válido en /api/catalogo (HTTP ${String(respuesta.estado)})`);
  }
  return respuesta.cuerpo;
}

async function pedirRed(base: string, par: Par): Promise<RespuestaApi> {
  const consulta = new URLSearchParams({ motor: par.motor, sistema: par.sistema, tec: TEC });
  return pedir(`${sinBarraFinal(base)}/api/red?${consulta.toString()}`, TIMEOUT_RED_MS);
}

// ---------- Selección de casos públicos ----------

interface SistemaCatalogo {
  readonly id: string;
  readonly archivos?: unknown;
  readonly disponible?: unknown;
}

function sistemasDe(motor: unknown): SistemaCatalogo[] {
  if (!esObjeto(motor) || !Array.isArray(motor.sistemas)) return [];
  return motor.sistemas.filter((s): s is SistemaCatalogo => esObjeto(s) && typeof s.id === "string");
}

function motoresDe(catalogo: unknown): { id: string; sistemas: SistemaCatalogo[] }[] {
  const motores = esObjeto(catalogo) && Array.isArray(catalogo.motores) ? catalogo.motores : [];
  return motores.filter(esObjeto).filter((m): m is Record<string, unknown> & { id: string } => typeof m.id === "string").map((m) => ({ id: m.id, sistemas: sistemasDe(m) }));
}

/** Carpeta de datos del caso: la del primer fichero que define la red (el mismo criterio que el importador). */
function carpetaDeDatos(archivos: unknown): string | undefined {
  if (!esObjeto(archivos)) return undefined;
  const claves = Object.entries(archivos).map(([clave, valor]) => ({
    clave,
    rutas: (Array.isArray(valor) ? valor : [valor]).filter((r): r is string => typeof r === "string"),
  }));
  const principal = ficheroPrincipal(claves);
  return principal === undefined ? undefined : path.posix.dirname(principal.replace(/\\/g, "/"));
}

/** Un sistema de xpand es público si su id y su carpeta de datos figuran en la lista blanca. */
function esPublico(sistema: SistemaCatalogo, lista: ListaBlanca): boolean {
  const carpeta = carpetaDeDatos(sistema.archivos);
  if (carpeta === undefined || sistema.disponible === false) return false;
  return lista.sistemas.some((e) => e.sistema === sistema.id && (carpeta === e.datos || carpeta.endsWith(`/${e.datos}`)));
}

function paresDe(catalogo: unknown, filtro: (sistema: SistemaCatalogo) => boolean): Par[] {
  return motoresDe(catalogo).flatMap((m) => m.sistemas.filter(filtro).map((s) => ({ motor: m.id, sistema: s.id })));
}

const clave = (par: Par): string => `${par.motor}\0${par.sistema}`;

// ---------- Comparación ----------

function describirRespuesta(respuesta: RespuestaApi): string {
  const codigo = esObjeto(respuesta.cuerpo) && esObjeto(respuesta.cuerpo.error) ? respuesta.cuerpo.error.codigo : undefined;
  if (respuesta.estado === 200 && !esRedValida(respuesta.cuerpo)) return "HTTP 200, red no válida";
  return typeof codigo === "string" ? `HTTP ${String(respuesta.estado)} ${codigo}` : `HTTP ${String(respuesta.estado)}`;
}

/** Diferencias de un caso: o bien una respuesta que no es una red válida, o bien las redes campo a campo. */
function hallazgosDelCaso(xpand: RespuestaApi, plataforma: RespuestaApi): Hallazgo[] {
  if (!esRedValida(xpand.cuerpo) || !esRedValida(plataforma.cuerpo) || xpand.estado !== 200 || plataforma.estado !== 200) {
    return [{ ruta: "(respuesta)", xpand: describirRespuesta(xpand), plataforma: describirRespuesta(plataforma) }];
  }
  return diferenciasRed(proyectarRed(xpand.cuerpo), proyectarRed(plataforma.cuerpo));
}

/** Compara los casos públicos de xpand con la plataforma. La plataforma solo sirve públicos, así que ese conjunto se suma. */
export async function compararConXpand(xpandUrl: string, plataformaUrl: string, lista: ListaBlanca): Promise<Resultado> {
  const catalogoXpand = await pedirCatalogo(xpandUrl);
  const catalogoPlataforma = await pedirCatalogo(plataformaUrl);
  const enPlataforma = paresDe(catalogoPlataforma, () => true);
  const servidosPorPlataforma = new Set(enPlataforma.map(clave));
  const publicosDeXpand = paresDe(catalogoXpand, (s) => esPublico(s, lista));

  const casos = new Map<string, Par>();
  for (const par of [...enPlataforma, ...publicosDeXpand]) casos.set(clave(par), par);

  const diferencias: Diferencia[] = [];
  const esperados: Esperado[] = [];
  for (const [claveCaso, par] of [...casos].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const redXpand = await pedirRed(xpandUrl, par);
    const redPlataforma = await pedirRed(plataformaUrl, par);
    for (const hallazgo of hallazgosDelCaso(redXpand, redPlataforma)) diferencias.push({ ...par, ...hallazgo });
    if (servidosPorPlataforma.has(claveCaso) && esRedValida(redXpand.cuerpo) && redXpand.estado === 200) {
      esperados.push({ ...par, red: proyectarRed(redXpand.cuerpo) });
    }
  }
  return { casos: casos.size, diferencias, esperados };
}

/** Escribe <dir>/<motor>/<sistema>/esperado-red.json; devuelve cuántos. Los ids se validan: vienen de un servidor. */
export function guardarEsperados(dir: string, esperados: readonly Esperado[]): number {
  for (const { motor, sistema, red } of esperados) {
    if (!esIdValido(motor) || !esIdValido(sistema)) throw new ErrorComparacion(`id de caso no válido: ${motor}/${sistema}`);
    const carpeta = path.join(dir, motor, sistema);
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(path.join(carpeta, "esperado-red.json"), `${JSON.stringify(red, null, 2)}\n`);
  }
  return esperados.length;
}

// ---------- Línea de órdenes ----------

interface Args {
  readonly xpandUrl: string;
  readonly plataformaUrl: string;
  readonly guardarEsperado?: string;
}

function urlValida(opcion: string, valor: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ErrorComparacion(`${opcion} no es una URL válida: ${valor}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ErrorComparacion(`${opcion} debe ser http o https`);
  return valor;
}

export function parsearArgs(argv: readonly string[]): Args {
  let xpandUrl: string | undefined;
  let plataformaUrl: string | undefined;
  let guardarEsperado: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const opcion = argv[i];
    const siguiente = argv[i + 1];
    if (opcion === "--xpand-url" || opcion === "--plataforma-url" || opcion === "--guardar-esperado") {
      if (siguiente === undefined || siguiente.startsWith("--")) throw new ErrorComparacion(`${opcion} necesita un valor`);
      if (opcion === "--xpand-url") xpandUrl = siguiente;
      else if (opcion === "--plataforma-url") plataformaUrl = siguiente;
      else guardarEsperado = siguiente;
      i++;
    } else {
      throw new ErrorComparacion(`opción desconocida: ${String(opcion)}`);
    }
  }
  if (xpandUrl === undefined) throw new ErrorComparacion("falta --xpand-url <url>");
  if (plataformaUrl === undefined) throw new ErrorComparacion("falta --plataforma-url <url>");
  return {
    xpandUrl: urlValida("--xpand-url", xpandUrl),
    plataformaUrl: urlValida("--plataforma-url", plataformaUrl),
    ...(guardarEsperado === undefined ? {} : { guardarEsperado }),
  };
}

function resumen(resultado: Resultado, guardados: number | undefined): string {
  const lineas = [`Casos comparados: ${String(resultado.casos)} (tec=${TEC})`];
  if (guardados !== undefined) lineas.push(`Esperados escritos: ${String(guardados)}`);
  lineas.push(`Diferencias: ${String(resultado.diferencias.length)}`);
  for (const d of resultado.diferencias) lineas.push(`${d.motor}/${d.sistema} ${d.ruta}: xpand=${d.xpand} plataforma=${d.plataforma}`);
  return `${lineas.join("\n")}\n`;
}

/** Ejecuta el comparador con sus argumentos y devuelve código y texto (sin tocar stdout: lo usan las pruebas). */
export async function ejecutar(argv: readonly string[], opciones: OpcionesEjecutar = {}): Promise<Salida> {
  try {
    const args = parsearArgs(argv);
    const lista = opciones.listaBlanca ?? leerListaBlanca(readFileSync(RUTA_LISTA_BLANCA, "utf8"));
    const resultado = await compararConXpand(args.xpandUrl, args.plataformaUrl, lista);
    const guardados = args.guardarEsperado === undefined ? undefined : guardarEsperados(args.guardarEsperado, resultado.esperados);
    const codigo = resultado.diferencias.length === 0 ? CODIGO_OK : CODIGO_DIFERENCIAS;
    return { codigo, texto: resumen(resultado, guardados) };
  } catch (e) {
    if (e instanceof ErrorComparacion) return { codigo: CODIGO_USO, texto: `comparar-con-xpand: ${e.message}\n` };
    throw e;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ejecutar(process.argv.slice(2))
    .then((salida) => {
      (salida.codigo === CODIGO_USO ? process.stderr : process.stdout).write(salida.texto);
      process.exitCode = salida.codigo;
    })
    .catch((e: unknown) => {
      console.error(`comparar-con-xpand: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = CODIGO_USO;
    });
}
