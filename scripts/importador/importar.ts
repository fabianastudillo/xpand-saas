// Importacion de casos al almacen: decide que (motor, sistema) del volcado entran, con que visibilidad y que ficheros
// llevan, y escribe el almacen entero de una vez (se prepara en una carpeta hermana y se cambia por la anterior), asi
// que reimportar da el mismo arbol y un caso que sale de la lista blanca deja de servirse.
//
// Nunca escribe dentro del checkout de xpand: solo lo lee (realpath, stat y copia de los ficheros del caso).
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { abrirAlmacen, type Manifiesto, type Visibilidad } from "@xpand/casos";
import { anadirVecinos, Copias, dentroDe, FicheroNoValido, NOMBRE_MANIFIESTO, resolverEnCheckout } from "./ficheros";
import { buscarEnLista, PATRON_INTERNO, type ListaBlanca } from "./lista-blanca";
import { registrarTemporal } from "./temporales";
import {
  archivosDelVolcado,
  ficheroPrincipal,
  motorDelManifiesto,
  sistemaDelManifiesto,
  type MotorVolcado,
  type SistemaVolcado,
  type Volcado,
} from "./metadatos";

/** Fichero que marca un almacen escrito por el importador: solo una carpeta asi (o vacia) se puede sustituir. */
export const MARCA = ".importador-xpand.json";
const CONTENIDO_MARCA = `${JSON.stringify({ escrito_por: "scripts/importar-casos.ts", aviso: "Se sustituye entero en cada importacion." }, null, 2)}\n`;
const REPO_POR_DEFECTO = "XPAND-PLEXSYS/xpand";

export type Motivo =
  | "no_publico"
  | "patron_interno"
  | "no_disponible"
  | "metadatos_incompletos"
  | "archivo_no_valido"
  | "fuera_de_carpeta_publica"
  | "enlace_duro";

export interface OpcionesImportar {
  readonly xpand: string;
  readonly almacen: string;
  readonly volcado: Volcado;
  readonly listaBlanca: ListaBlanca;
  readonly incluirInternos: boolean;
  readonly commit: string;
  readonly repo?: string;
}

export interface Informe {
  readonly importados: readonly { motor: string; sistema: string; visibilidad: Visibilidad }[];
  /** Solo cuentas por motivo: los ids omitidos pueden ser de casos internos y no se registran. */
  readonly omitidos: readonly { motivo: Motivo; cuantos: number }[];
  /** Ficheros de datos copiados (sin contar los manifiestos). */
  readonly ficheros: number;
}

interface Plan {
  readonly manifiesto: Manifiesto;
  readonly copias: ReadonlyMap<string, string>;
}

interface Contexto {
  readonly checkoutReal: string;
  readonly opts: OpcionesImportar;
}

const relativa = (ctx: Contexto, real: string) => path.relative(ctx.checkoutReal, real).split(path.sep).join("/");

/**
 * Copias y `archivos` del manifiesto (nombres sin carpeta, con la forma lista/cadena de cada clave). `dirBase` es la
 * carpeta REAL del primer base: los vecinos se buscan ahi y en las carpetas reales de los declarados, nunca en la ruta
 * sin resolver del volcado (un enlace podria apuntar a otra carpeta).
 */
function resolverFicheros(
  ctx: Contexto,
  raiz: string,
  archivos: NonNullable<ReturnType<typeof archivosDelVolcado>>,
  dirBase: string,
): { copias: Copias; declarados: Manifiesto["archivos"] } {
  const copias = new Copias();
  const declarados: Manifiesto["archivos"] = {};
  const dirs: string[] = [];
  for (const { clave, rutas, lista } of archivos) {
    const nombres = rutas.map((r) => {
      const absoluta = path.resolve(raiz, r);
      const nombre = path.basename(absoluta);
      const real = resolverEnCheckout(ctx.checkoutReal, absoluta);
      copias.anadir(nombre, real);
      if (!dirs.includes(path.dirname(real))) dirs.push(path.dirname(real));
      return nombre;
    });
    declarados[clave] = lista ? nombres : (nombres[0] ?? "");
  }
  anadirVecinos(ctx.checkoutReal, dirBase, dirs, copias);
  return { copias, declarados };
}

/**
 * Un candidato a publico que nombra datos internos en sus metadatos, en las rutas de origen o en el CONTENIDO de sus
 * ficheros (p. ej. un comentario que dice de que caso interno salen unos costos) no se publica: ante la duda, interno.
 */
function delataDatosInternos(ctx: Contexto, manifiesto: Manifiesto, copias: Copias): boolean {
  if (PATRON_INTERNO.test(JSON.stringify(manifiesto))) return true;
  for (const real of copias.porNombre.values()) {
    if (PATRON_INTERNO.test(relativa(ctx, real)) || PATRON_INTERNO.test(readFileSync(real, "utf8"))) return true;
  }
  return false;
}

type Resultado = { plan: Plan; visibilidad: Visibilidad } | { motivo: Motivo };

function planificar(ctx: Contexto, motor: MotorVolcado, bloqueMotor: Manifiesto["motor"], s: SistemaVolcado): Resultado {
  const archivos = archivosDelVolcado(s);
  const principal = archivos && ficheroPrincipal(archivos);
  if (typeof s.id !== "string" || archivos === undefined || principal === undefined) return { motivo: "metadatos_incompletos" };
  if (s.disponible === false) return { motivo: "no_disponible" };
  const raiz = typeof motor.raiz === "string" ? motor.raiz : ctx.checkoutReal;
  // La visibilidad se decide antes de leer nada mas: de un caso que no se va a importar solo se resuelve esta ruta.
  let dirDatos: string;
  try {
    dirDatos = path.dirname(resolverEnCheckout(ctx.checkoutReal, path.resolve(raiz, principal)));
  } catch (e) {
    if (e instanceof FicheroNoValido) return { motivo: "archivo_no_valido" };
    throw e;
  }
  const entrada = buscarEnLista(ctx.opts.listaBlanca, s.id, relativa(ctx, dirDatos));
  if (entrada === undefined && !ctx.opts.incluirInternos) return { motivo: "no_publico" };
  const sistema = sistemaDelManifiesto(s, entrada?.fuente);
  if (sistema === undefined) return { motivo: "metadatos_incompletos" };
  let ficheros: ReturnType<typeof resolverFicheros>;
  try {
    ficheros = resolverFicheros(ctx, raiz, archivos, dirDatos);
  } catch (e) {
    if (e instanceof FicheroNoValido) return { motivo: "archivo_no_valido" };
    throw e;
  }
  // La lista blanca aprueba una carpeta: un caso de la lista solo puede copiar ficheros cuya ruta real este dentro de
  // ella. Un enlace o un «..» hacia otra carpeta del checkout (que puede ser interna) lo deja fuera, no solo no publico.
  if (entrada !== undefined && [...ficheros.copias.porNombre.values()].some((real) => !dentroDe(dirDatos, real))) {
    return { motivo: "fuera_de_carpeta_publica" };
  }
  // Un fichero con mas de un enlace duro comparte inodo con otra ruta que puede ser interna: no se puede probar que
  // sea solo de la carpeta aprobada.
  if (entrada !== undefined && [...ficheros.copias.porNombre.values()].some((real) => statSync(real).nlink > 1)) {
    return { motivo: "enlace_duro" };
  }
  const manifiesto: Manifiesto = {
    motor: bloqueMotor,
    sistema,
    archivos: ficheros.declarados,
    visibilidad: "interno",
    origen: { repo: ctx.opts.repo ?? REPO_POR_DEFECTO, commit: ctx.opts.commit, ruta: relativa(ctx, dirDatos) },
  };
  const publico = entrada !== undefined && !delataDatosInternos(ctx, manifiesto, ficheros.copias);
  if (!publico && !ctx.opts.incluirInternos) return { motivo: entrada !== undefined ? "patron_interno" : "no_publico" };
  const visibilidad: Visibilidad = publico ? "publico" : "interno";
  return { plan: { manifiesto: { ...manifiesto, visibilidad }, copias: ficheros.copias.porNombre }, visibilidad };
}

/** Ruta real de `p` aunque no exista todavia (realpath del ancestro que existe mas el resto). */
function realAunqueNoExista(p: string): string {
  const abs = path.resolve(p);
  if (existsSync(abs)) return realpathSync(abs);
  const padre = path.dirname(abs);
  return padre === abs ? abs : path.join(realAunqueNoExista(padre), path.basename(abs));
}

function comprobarDestino(almacen: string, checkoutReal: string): void {
  const real = realAunqueNoExista(almacen);
  if (real === checkoutReal || dentroDe(checkoutReal, real) || dentroDe(real, checkoutReal)) {
    throw new Error(`El almacen (${almacen}) cae dentro del checkout de xpand o lo contiene: el importador nunca escribe en xpand.`);
  }
  if (!existsSync(almacen)) return;
  if (!statSync(almacen).isDirectory()) throw new Error(`${almacen} existe y no es una carpeta.`);
  const entradas = readdirSync(almacen);
  if (entradas.length > 0 && !entradas.includes(MARCA)) {
    throw new Error(`${almacen} tiene contenido y no la escribio el importador (falta ${MARCA}): no se sustituye.`);
  }
}

function escribirCaso(raiz: string, plan: Plan): number {
  const { motor, sistema } = plan.manifiesto;
  const dir = path.join(raiz, motor.id, sistema.id);
  mkdirSync(dir, { recursive: true });
  for (const [nombre, origen] of plan.copias) copyFileSync(origen, path.join(dir, nombre));
  writeFileSync(path.join(dir, NOMBRE_MANIFIESTO), `${JSON.stringify(plan.manifiesto, null, 2)}\n`);
  return plan.copias.size;
}

/** Comprueba con el propio almacen que todo lo preparado se abre sin avisos. */
async function verificar(dir: string, esperados: number): Promise<void> {
  if (esperados === 0) return; // un almacen sin casos solo da el aviso de «vacio»
  const almacen = await abrirAlmacen(dir);
  const abiertos = almacen.casos({ incluirInternos: true }).length;
  if (almacen.detalles.length > 0 || abiertos !== esperados) {
    throw new Error(`el almacen preparado no se abre limpio (${String(abiertos)} de ${String(esperados)} casos):\n${almacen.detalles.join("\n")}`);
  }
}

/** Carpeta hermana de `final` con nombre impredecible (mkdtemp, modo 0700). */
const hermanaTemporal = (final: string, sufijo: string) => mkdtempSync(path.join(path.dirname(final), `.${path.basename(final)}.${sufijo}-`));

/** Modo de la raiz del almacen: legible por el servidor aunque corra con otro usuario (mkdtemp la crea 0700). */
const MODO_RAIZ_ALMACEN = 0o755;

/** Sustituye `final` por `preparado` (las dos en la misma carpeta padre) y borra la version anterior. */
function sustituir(preparado: string, final: string): void {
  chmodSync(preparado, MODO_RAIZ_ALMACEN);
  if (!existsSync(final)) {
    renameSync(preparado, final);
    return;
  }
  const anterior = hermanaTemporal(final, "anterior");
  renameSync(final, path.join(anterior, "almacen"));
  renameSync(preparado, final);
  rmSync(anterior, { recursive: true, force: true });
}

function cuentas(motivos: readonly Motivo[]): Informe["omitidos"] {
  const n = new Map<Motivo, number>();
  for (const m of motivos) n.set(m, (n.get(m) ?? 0) + 1);
  return [...n.entries()].map(([motivo, cuantos]) => ({ motivo, cuantos })).sort((a, b) => a.motivo.localeCompare(b.motivo));
}

export async function importarCasos(opts: OpcionesImportar): Promise<Informe> {
  const checkoutReal = realpathSync(opts.xpand);
  const final = path.resolve(opts.almacen);
  comprobarDestino(final, checkoutReal);
  const ctx: Contexto = { checkoutReal, opts };
  const planes: Plan[] = [];
  const omitidos: Motivo[] = [];
  for (const motor of opts.volcado.motores) {
    const bloque = motorDelManifiesto(motor);
    for (const s of motor.sistemas) {
      const r: Resultado = bloque === undefined ? { motivo: "metadatos_incompletos" } : planificar(ctx, motor, bloque, s);
      if ("plan" in r) planes.push(r.plan);
      else omitidos.push(r.motivo);
    }
  }
  const claves = planes.map((p) => `${p.manifiesto.motor.id}/${p.manifiesto.sistema.id}`);
  if (new Set(claves).size !== claves.length) throw new Error("el volcado trae dos veces el mismo motor/sistema");

  mkdirSync(path.dirname(final), { recursive: true });
  const preparado = hermanaTemporal(final, "importando");
  const liberar = registrarTemporal(preparado);
  try {
    const ficheros = planes.reduce((n, p) => n + escribirCaso(preparado, p), 0);
    writeFileSync(path.join(preparado, MARCA), CONTENIDO_MARCA);
    await verificar(preparado, planes.length);
    sustituir(preparado, final);
    return {
      importados: planes.map((p) => ({ motor: p.manifiesto.motor.id, sistema: p.manifiesto.sistema.id, visibilidad: p.manifiesto.visibilidad })),
      omitidos: cuentas(omitidos),
      ficheros,
    };
  } finally {
    rmSync(preparado, { recursive: true, force: true });
    liberar();
  }
}
