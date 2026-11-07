// pnpm comparar-con-xpand --xpand-url <url> --plataforma-url <url> [--guardar-esperado <dir>]
//
// Compara, campo a campo y con igualdad exacta, la red que sirve /api/red de la plataforma con la de un servidor
// xpand en marcha (solo lectura: GET a /api/catalogo y /api/red con tec=ac), y la fila pública del catálogo de cada
// caso (`nombre`, `barras`, `referencias[].valor` y `.tecnologias`: lo que la interfaz enseña de un sistema).
//
// El conjunto público es explícito: un caso de xpand es público solo si figura en --publicos <fichero> (por defecto
// config/casos-publicos.json, mismo formato y cargador que el importador) con su id y su carpeta de datos. Solo esos
// casos se comparan, se imprimen con sus valores y se escriben. Un caso que la plataforma sirve y no está en ese
// conjunto se informa solo por id, sin valores, y no se escribe. Si no se compara ningún caso, el resultado es 1.
// De la red solo se comparan los campos del contrato (contracts/api/red.schema.json: sus colecciones y, si los hubiera,
// sus campos de nivel superior); ids y `de`/`a` se pasan a cadena. De la fila del catálogo, la misma proyección en los
// dos lados: una referencia sin `valor` numérico queda fuera (el contrato lo exige; el importador y el servidor la
// quitan) y `fuente` no se compara (el importador la sustituye por la de la lista blanca si viene vacía).
//
// Códigos de salida: 0 sin diferencias, 1 con diferencias (o sin casos que comparar), 64 uso incorrecto o servidor
// inalcanzable. Con --guardar-esperado escribe <dir>/<motor>/<sistema>/esperado-red.json (la red de xpand, en el
// contrato) de cada caso público que sirve la plataforma; es la referencia de packages/casos/src/red.test.ts.
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

const RUTA_PUBLICOS_POR_DEFECTO = fileURLToPath(new URL("../config/casos-publicos.json", import.meta.url));
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
const CODIGO_SIN_CASOS = 1;

interface SchemaRed {
  properties: Record<string, unknown>;
  definitions: Record<string, { properties: Record<string, unknown> }>;
}
const SCHEMA_RED = JSON.parse(readFileSync(RUTA_SCHEMA_RED, "utf8")) as SchemaRed;

/** Campos del contrato por colección, leídos del schema (no una lista a mano). */
function camposDelContrato(): Record<Coleccion, readonly string[]> {
  const campos = {} as Record<Coleccion, readonly string[]>;
  for (const [coleccion, definicion] of COLECCIONES) {
    const propiedades = SCHEMA_RED.definitions[definicion]?.properties;
    if (propiedades === undefined) throw new Error(`red.schema.json no define «${definicion}»`);
    campos[coleccion] = Object.keys(propiedades);
  }
  return campos;
}
const CAMPOS = camposDelContrato();
/** Campos de nivel superior de la red en el contrato, aparte de las colecciones (hoy ninguno). */
const CAMPOS_RAIZ_RED: readonly string[] = Object.keys(SCHEMA_RED.properties).filter(
  (campo) => !COLECCIONES.some(([coleccion]) => coleccion === campo),
);

/** Campos de la fila pública de un sistema que se comparan, y de cada una de sus referencias. */
const CAMPOS_FILA = ["nombre", "barras"] as const;
const CAMPOS_REFERENCIA = ["valor", "tecnologias"] as const;

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
  /** Conjunto público ya leído (pruebas); por defecto, el fichero de --publicos o config/casos-publicos.json. */
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

type Registro = Record<string, unknown>;

/** Un valor como texto para el informe; -0 se distingue de 0 (JSON.stringify lo escribe igual). */
const formatear = (valor: unknown): string => {
  if (valor === undefined) return "(ausente)";
  if (Object.is(valor, -0)) return "-0";
  return JSON.stringify(valor);
};

/** Compara dos valores campo a campo; los números y textos, con Object.is (exacto, incluido el signo del cero). */
function compararValores(xpand: unknown, plataforma: unknown, ruta: string, hallazgos: Hallazgo[]): void {
  if (esObjeto(xpand) && esObjeto(plataforma)) {
    for (const clave of new Set([...Object.keys(xpand), ...Object.keys(plataforma)])) {
      const subruta = ruta === "" ? clave : `${ruta}.${clave}`;
      compararValores(xpand[clave], plataforma[clave], subruta, hallazgos);
    }
    return;
  }
  if (!Object.is(xpand, plataforma)) hallazgos.push({ ruta, xpand: formatear(xpand), plataforma: formatear(plataforma) });
}

const idsUnicos = (registros: readonly Registro[]): boolean => new Set(registros.map((r) => String(r.id))).size === registros.length;

/** Clave de cada registro: su id; si los ids repiten, de/a (o el id en barras) más la ocurrencia dentro de esa base. */
function clavesDe(registros: readonly Registro[], coleccion: Coleccion, porId: boolean): string[] {
  if (porId) return registros.map((r) => String(r.id));
  const ocurrencias = new Map<string, number>();
  return registros.map((r) => {
    const base = coleccion === "barras" ? String(r.id) : `${String(r.de)}>${String(r.a)}`;
    const n = ocurrencias.get(base) ?? 0;
    ocurrencias.set(base, n + 1);
    return `${base}#${String(n)}`;
  });
}

/** Una colección por claves: faltantes y sobrantes por nombre, campos de los emparejados y un solo aviso de orden. */
function compararColeccion(coleccion: Coleccion, xs: readonly Registro[], ps: readonly Registro[], hallazgos: Hallazgo[]): void {
  const porId = idsUnicos(xs) && idsUnicos(ps);
  const kx = clavesDe(xs, coleccion, porId);
  const kp = clavesDe(ps, coleccion, porId);
  const posP = new Map(kp.map((k, j) => [k, j]));
  const claveX = new Set(kx);
  kx.forEach((k) => {
    if (!posP.has(k)) hallazgos.push({ ruta: `${coleccion}[id=${k}]`, xpand: "presente", plataforma: "(ausente)" });
  });
  kp.forEach((k) => {
    if (!claveX.has(k)) hallazgos.push({ ruta: `${coleccion}[id=${k}]`, xpand: "(ausente)", plataforma: "presente" });
  });
  const emparejados: [number, string][] = [];
  kx.forEach((k, i) => {
    const j = posP.get(k);
    if (j === undefined) return;
    emparejados.push([i, k]);
    const registroX = xs[i];
    const registroP = ps[j];
    if (registroX !== undefined && registroP !== undefined) compararValores(registroX, registroP, `${coleccion}[${String(i)}]`, hallazgos);
  });
  const ordenX = emparejados.map(([, k]) => k).join("\0");
  const ordenP = kp.filter((k) => claveX.has(k)).join("\0");
  if (ordenX !== ordenP) hallazgos.push({ ruta: `${coleccion} (orden)`, xpand: "orden de xpand", plataforma: "orden distinto" });
}

/** Diferencias entre dos proyecciones: por colección, con la ruta del lado de xpand (p. ej. `barras[1].pd`). */
export function diferenciasRed(xpand: Proyeccion, plataforma: Proyeccion): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const [coleccion] of COLECCIONES) compararColeccion(coleccion, xpand[coleccion], plataforma[coleccion], hallazgos);
  return hallazgos;
}

/** Los campos de nivel superior del contrato (fuera de las colecciones), con su nombre como ruta. */
function diferenciasRaizRed(xpand: Registro, plataforma: Registro): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const campo of CAMPOS_RAIZ_RED) compararValores(xpand[campo], plataforma[campo], campo, hallazgos);
  return hallazgos;
}

// ---------- Proyección y comparación de la fila del catálogo ----------

export interface FilaCatalogo {
  readonly campos: Registro;
  readonly referencias: readonly Registro[];
}

const soloCamposDe = (registro: Registro, campos: readonly string[]): Registro =>
  Object.fromEntries(campos.filter((campo) => registro[campo] !== undefined).map((campo) => [campo, registro[campo]]));

const tieneValorNumerico = (referencia: Registro): boolean => typeof referencia.valor === "number" && Number.isFinite(referencia.valor);

/** La fila pública de un sistema del catálogo: nombre, barras y, de cada referencia con valor numérico, valor y tecnologías. */
export function proyectarFila(sistema: Registro): FilaCatalogo {
  const referencias = Array.isArray(sistema.referencias) ? sistema.referencias.filter(esObjeto).filter(tieneValorNumerico) : [];
  return {
    campos: soloCamposDe(sistema, CAMPOS_FILA),
    referencias: referencias.map((referencia) => soloCamposDe(referencia, CAMPOS_REFERENCIA)),
  };
}

const RUTA_FILA = "catalogo";

/** Diferencias entre las filas de un caso; sin fila en la plataforma, una sola línea. Referencias por posición. */
export function diferenciasFila(xpand: Registro | undefined, plataforma: Registro | undefined): Hallazgo[] {
  if (xpand === undefined || plataforma === undefined) {
    if (xpand === plataforma) return [];
    return [{ ruta: RUTA_FILA, xpand: xpand ? "presente" : "(ausente)", plataforma: plataforma ? "presente" : "(ausente)" }];
  }
  const hallazgos: Hallazgo[] = [];
  const fx = proyectarFila(xpand);
  const fp = proyectarFila(plataforma);
  compararValores(fx.campos, fp.campos, RUTA_FILA, hallazgos);
  for (let i = 0; i < Math.max(fx.referencias.length, fp.referencias.length); i++) {
    const ruta = `${RUTA_FILA}.referencias[${String(i)}]`;
    const rx = fx.referencias[i];
    const rp = fp.referencias[i];
    if (rx !== undefined && rp !== undefined) compararValores(rx, rp, ruta, hallazgos);
    else hallazgos.push({ ruta, xpand: rx ? "presente" : "(ausente)", plataforma: rp ? "presente" : "(ausente)" });
  }
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
function esPublico(motor: string, sistema: SistemaCatalogo, lista: ListaBlanca): boolean {
  const carpeta = carpetaDeDatos(sistema.archivos);
  if (carpeta === undefined || sistema.disponible === false) return false;
  // xpand sirve rutas absolutas: la carpeta de la lista se compara como sufijo de la suya, por fronteras de ruta.
  return lista.sistemas.some(
    (e) =>
      e.sistema === sistema.id &&
      (carpeta === e.datos || carpeta.endsWith(`/${e.datos}`)) &&
      (e.motores === undefined || e.motores.includes(motor)),
  );
}

function paresDe(catalogo: unknown, filtro: (motor: string, sistema: SistemaCatalogo) => boolean): Par[] {
  return motoresDe(catalogo).flatMap((m) => m.sistemas.filter((s) => filtro(m.id, s)).map((s) => ({ motor: m.id, sistema: s.id })));
}

const clave = (par: Par): string => `${par.motor}\0${par.sistema}`;

// ---------- Comparación ----------

function describirRespuesta(respuesta: RespuestaApi): string {
  const codigo = esObjeto(respuesta.cuerpo) && esObjeto(respuesta.cuerpo.error) ? respuesta.cuerpo.error.codigo : undefined;
  if (respuesta.estado === 200 && !esRedValida(respuesta.cuerpo)) return "HTTP 200, red no válida";
  return typeof codigo === "string" ? `HTTP ${String(respuesta.estado)} ${codigo}` : `HTTP ${String(respuesta.estado)}`;
}

/** Diferencias de la red de un caso: o bien una respuesta que no es una red válida, o bien las redes campo a campo. */
function hallazgosDelCaso(xpand: RespuestaApi, plataforma: RespuestaApi): Hallazgo[] {
  if (!esRedValida(xpand.cuerpo) || !esRedValida(plataforma.cuerpo) || xpand.estado !== 200 || plataforma.estado !== 200) {
    return [{ ruta: "(respuesta)", xpand: describirRespuesta(xpand), plataforma: describirRespuesta(plataforma) }];
  }
  return [
    ...diferenciasRaizRed(xpand.cuerpo, plataforma.cuerpo),
    ...diferenciasRed(proyectarRed(xpand.cuerpo), proyectarRed(plataforma.cuerpo)),
  ];
}

/** Cada sistema del catálogo por su par motor/sistema (el objeto entero; la proyección elige los campos). */
function filasDe(catalogo: unknown): Map<string, Registro> {
  const filas = new Map<string, Registro>();
  for (const motor of motoresDe(catalogo)) {
    for (const sistema of motor.sistemas) filas.set(clave({ motor: motor.id, sistema: sistema.id }), sistema as unknown as Registro);
  }
  return filas;
}

const ordenar = (pares: readonly Par[]): Par[] => [...pares].sort((a, b) => (clave(a) < clave(b) ? -1 : 1));

/**
 * Compara los casos públicos (los que xpand tiene dentro de `lista`). Un caso que la plataforma sirve fuera de ese
 * conjunto se informa solo por id: no se pide ni se imprime ni se escribe.
 */
export async function compararConXpand(xpandUrl: string, plataformaUrl: string, lista: ListaBlanca): Promise<Resultado> {
  const catalogoXpand = await pedirCatalogo(xpandUrl);
  const catalogoPlataforma = await pedirCatalogo(plataformaUrl);
  const publicos = ordenar(paresDe(catalogoXpand, (motor, s) => esPublico(motor, s, lista)));
  const clavesPublicas = new Set(publicos.map(clave));
  const enPlataforma = paresDe(catalogoPlataforma, () => true);
  const servidosPorPlataforma = new Set(enPlataforma.map(clave));
  const filasXpand = filasDe(catalogoXpand);
  const filasPlataforma = filasDe(catalogoPlataforma);

  const diferencias: Diferencia[] = [];
  const esperados: Esperado[] = [];
  for (const par of publicos) {
    for (const hallazgo of diferenciasFila(filasXpand.get(clave(par)), filasPlataforma.get(clave(par)))) {
      diferencias.push({ ...par, ...hallazgo });
    }
    const redXpand = await pedirRed(xpandUrl, par);
    const redPlataforma = await pedirRed(plataformaUrl, par);
    for (const hallazgo of hallazgosDelCaso(redXpand, redPlataforma)) diferencias.push({ ...par, ...hallazgo });
    if (servidosPorPlataforma.has(clave(par)) && esRedValida(redXpand.cuerpo) && redXpand.estado === 200) {
      esperados.push({ ...par, red: proyectarRed(redXpand.cuerpo) });
    }
  }
  for (const par of ordenar(enPlataforma)) {
    if (clavesPublicas.has(clave(par))) continue;
    diferencias.push({ ...par, ruta: "(caso)", xpand: "(fuera del conjunto público)", plataforma: "(servido)" });
  }
  return { casos: publicos.length, diferencias, esperados };
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
  readonly publicos?: string;
  readonly publicosDePrueba: boolean;
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

const OPCIONES_CON_VALOR = new Set(["--xpand-url", "--plataforma-url", "--guardar-esperado", "--publicos"]);

export function parsearArgs(argv: readonly string[]): Args {
  const valores: Record<string, string> = {};
  let publicosDePrueba = false;
  for (let i = 0; i < argv.length; i++) {
    const opcion = argv[i];
    const siguiente = argv[i + 1];
    if (opcion === "--publicos-de-prueba") {
      publicosDePrueba = true;
    } else if (opcion !== undefined && OPCIONES_CON_VALOR.has(opcion)) {
      if (siguiente === undefined || siguiente.startsWith("--")) throw new ErrorComparacion(`${opcion} necesita un valor`);
      valores[opcion] = siguiente;
      i++;
    } else {
      throw new ErrorComparacion(`opción desconocida: ${String(opcion)}`);
    }
  }
  const xpandUrl = valores["--xpand-url"];
  const plataformaUrl = valores["--plataforma-url"];
  if (xpandUrl === undefined) throw new ErrorComparacion("falta --xpand-url <url>");
  if (plataformaUrl === undefined) throw new ErrorComparacion("falta --plataforma-url <url>");
  if (publicosDePrueba && valores["--publicos"] === undefined) {
    throw new ErrorComparacion("--publicos-de-prueba necesita --publicos <fichero>");
  }
  const guardarEsperado = valores["--guardar-esperado"];
  const publicos = valores["--publicos"];
  return {
    xpandUrl: urlValida("--xpand-url", xpandUrl),
    plataformaUrl: urlValida("--plataforma-url", plataformaUrl),
    publicosDePrueba,
    ...(guardarEsperado === undefined ? {} : { guardarEsperado }),
    ...(publicos === undefined ? {} : { publicos }),
  };
}

/** Lee el conjunto público: el de --publicos (fuente relajada solo con --publicos-de-prueba) o el de producción. */
function cargarPublicos(args: Args): ListaBlanca {
  const exigirFuenteVerificable = !args.publicosDePrueba;
  const ruta = args.publicos === undefined ? RUTA_PUBLICOS_POR_DEFECTO : path.resolve(args.publicos);
  try {
    return leerListaBlanca(readFileSync(ruta, "utf8"), { exigirFuenteVerificable });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    throw new ErrorComparacion(`no se puede usar el conjunto público ${ruta}: ${motivo}`);
  }
}

function resumen(resultado: Resultado, guardados: number | undefined): string {
  const lineas: string[] = [];
  if (resultado.casos === 0) lineas.push("Sin casos: ningún caso público que comparar (revisa --publicos y los dos servidores).");
  lineas.push(`Casos comparados: ${String(resultado.casos)} (tec=${TEC})`);
  if (guardados !== undefined) lineas.push(`Esperados escritos: ${String(guardados)}`);
  lineas.push(`Diferencias: ${String(resultado.diferencias.length)}`);
  for (const d of resultado.diferencias) lineas.push(`${d.motor}/${d.sistema} ${d.ruta}: xpand=${d.xpand} plataforma=${d.plataforma}`);
  return `${lineas.join("\n")}\n`;
}

/** Ejecuta el comparador con sus argumentos y devuelve código y texto (sin tocar stdout: lo usan las pruebas). */
export async function ejecutar(argv: readonly string[], opciones: OpcionesEjecutar = {}): Promise<Salida> {
  try {
    const args = parsearArgs(argv);
    const lista = opciones.listaBlanca ?? cargarPublicos(args);
    const resultado = await compararConXpand(args.xpandUrl, args.plataformaUrl, lista);
    const guardados = args.guardarEsperado === undefined ? undefined : guardarEsperados(args.guardarEsperado, resultado.esperados);
    const sinCasos = resultado.casos === 0;
    const codigo = resultado.diferencias.length === 0 && !sinCasos ? CODIGO_OK : sinCasos ? CODIGO_SIN_CASOS : CODIGO_DIFERENCIAS;
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
