// pnpm importar-casos --xpand <checkout> [--almacen <dir>] [--incluir-internos] [--volcado <catalogo.json>]
//
// Llena el almacen de casos de la plataforma desde un checkout de xpand, que solo se lee:
// 1. Vuelca el catalogo ejecutando el Julia de ese checkout (scripts/julia/volcar-catalogo.jl) con GTNEP_SALIDAS y los
//    temporales en una carpeta temporal propia, que se borra al acabar. Con --volcado se usa un volcado ya hecho.
// 2. Comprueba que `git status --porcelain --ignored` del checkout es el mismo antes y despues (si no, aborta).
// 3. Importa solo los sistemas de config/casos-publicos.json, como `publico`. Con --incluir-internos importa tambien
//    el resto, como `interno` (la plataforma no los sirve en M0).
//
// Lo que se imprime son ids de casos publicos y cuentas: nunca rutas ni nombres de casos internos.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importarCasos, type Informe } from "./importador/importar";
import { leerListaBlanca } from "./importador/lista-blanca";
import { leerVolcado, type Volcado } from "./importador/metadatos";
import { instalarLimpiezaEnSenales, registrarLimpieza, registrarTemporal } from "./importador/temporales";

export { importarCasos, MARCA, type Informe, type Motivo, type OpcionesImportar } from "./importador/importar";
export { leerListaBlanca, PATRON_INTERNO, type ListaBlanca } from "./importador/lista-blanca";
export { leerVolcado, type Volcado } from "./importador/metadatos";

const LISTA_BLANCA = fileURLToPath(new URL("../config/casos-publicos.json", import.meta.url));
const VOLCADOR = fileURLToPath(new URL("./julia/volcar-catalogo.jl", import.meta.url));

export interface Args {
  readonly xpand: string;
  readonly almacen: string;
  readonly incluirInternos: boolean;
  readonly volcado?: string;
}

/** Opciones de la linea de ordenes. El almacen por defecto es el de la app: XPAND_ALMACEN o ~/.xpand-saas/almacen. */
export function parsearArgs(argv: readonly string[], env: NodeJS.ProcessEnv): Args {
  let xpand: string | undefined;
  let almacen = env.XPAND_ALMACEN?.trim() || path.join(os.homedir(), ".xpand-saas", "almacen");
  let incluirInternos = false;
  let volcado: string | undefined;
  const valor = (i: number, opcion: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${opcion} necesita un valor`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--xpand") xpand = valor(i++, a);
    else if (a === "--almacen") almacen = valor(i++, a);
    else if (a === "--volcado") volcado = valor(i++, a);
    else if (a === "--incluir-internos") incluirInternos = true;
    else throw new Error(`opcion desconocida: ${String(a)}`);
  }
  if (xpand === undefined) throw new Error("falta --xpand <checkout de xpand>");
  return { xpand, almacen, incluirInternos, ...(volcado === undefined ? {} : { volcado }) };
}

/** Estado del checkout sin tocar el indice (--no-optional-locks): `git status` normal reescribe .git/index. */
function estadoGit(checkout: string): string {
  return execFileSync("git", ["--no-optional-locks", "-C", checkout, "status", "--porcelain", "--ignored"], { encoding: "utf8" });
}

function commitDe(checkout: string): string {
  return execFileSync("git", ["--no-optional-locks", "-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

/** Codigo de salida de un proceso hijo (o la senal que lo mato); rechaza si no se pudo lanzar. */
function esperar(orden: string, args: readonly string[], opciones: Parameters<typeof spawn>[2]): Promise<number | string> {
  return new Promise((resolve, reject) => {
    const hijo = spawn(orden, args, opciones);
    // Ante una senal se mata al hijo antes de borrar su carpeta (si no, Julia podria volver a crearla).
    const liberar = registrarLimpieza(() => hijo.kill("SIGKILL"));
    hijo.on("error", (e) => {
      liberar();
      reject(e);
    });
    hijo.on("close", (codigo, senal) => {
      liberar();
      resolve(codigo ?? senal ?? "desconocido");
    });
  });
}

/**
 * Ejecuta el volcador del catalogo con todas las salidas de xpand en una carpeta temporal (mkdtemp) que se borra al
 * acabar, tambien si falla o si el proceso recibe SIGINT/SIGTERM (ver temporales.ts).
 */
export async function volcarCatalogo(checkout: string): Promise<Volcado> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "xpand-volcado-"));
  const liberar = registrarTemporal(tmp);
  try {
    const salida = path.join(tmp, "catalogo.json");
    const env = {
      ...process.env,
      GTNEP_SALIDAS: path.join(tmp, "salidas"),
      GTNEP_TEMP: path.join(tmp, "tmp"),
      GTNEP_WORKDIR: path.join(tmp, "salidas", "workdir"),
      TMPDIR: path.join(tmp, "tmp"),
      GTNEP_SIN_WORKLOAD: "1",
    };
    const julia = process.env.XPAND_JULIA?.trim() || "julia";
    let codigo: number | string;
    try {
      codigo = await esperar(julia, [`--project=${checkout}`, VOLCADOR, salida], { cwd: tmp, env, stdio: ["ignore", "inherit", "inherit"] });
    } catch (e) {
      throw new Error(`no se pudo ejecutar ${julia}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    if (codigo !== 0) throw new Error(`el volcado del catalogo fallo (codigo ${String(codigo)})`);
    return leerVolcado(readFileSync(salida, "utf8"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    liberar();
  }
}

function comprobarIntacto(checkout: string, antes: string, momento: string): void {
  if (estadoGit(checkout) !== antes) {
    throw new Error(
      `el checkout de xpand cambio ${momento} (git status --ignored distinto). No se importa nada: revise el checkout.`,
    );
  }
}

function resumen(informe: Informe, almacen: string): string {
  const publicos = informe.importados.filter((c) => c.visibilidad === "publico");
  const internos = informe.importados.length - publicos.length;
  const omitidos = informe.omitidos.map((o) => `  ${o.motivo}: ${String(o.cuantos)}`);
  return [
    `Almacen: ${almacen}`,
    `Importados: ${String(informe.importados.length)} (${String(publicos.length)} publicos, ${String(internos)} internos), ${String(informe.ficheros)} ficheros de datos`,
    ...publicos.map((c) => `  ${c.motor}/${c.sistema}`),
    `Omitidos: ${String(informe.omitidos.reduce((n, o) => n + o.cuantos, 0))}`,
    ...omitidos,
  ].join("\n");
}

export async function main(argv: readonly string[]): Promise<void> {
  const args = parsearArgs(argv, process.env);
  const checkout = realpathSync(args.xpand);
  const listaBlanca = leerListaBlanca(readFileSync(LISTA_BLANCA, "utf8"));
  const antes = estadoGit(checkout);
  const volcado = args.volcado === undefined ? await volcarCatalogo(checkout) : leerVolcado(readFileSync(args.volcado, "utf8"));
  comprobarIntacto(checkout, antes, "durante el volcado del catalogo");
  const almacen = path.resolve(args.almacen);
  const informe = await importarCasos({
    xpand: checkout,
    almacen,
    volcado,
    listaBlanca,
    incluirInternos: args.incluirInternos,
    commit: commitDe(checkout),
  });
  comprobarIntacto(checkout, antes, "durante la importacion");
  console.log(resumen(informe, almacen));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  instalarLimpiezaEnSenales();
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(`importar-casos: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
