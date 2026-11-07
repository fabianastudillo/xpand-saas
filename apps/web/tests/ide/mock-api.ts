import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page, Route } from "@playwright/test";

/**
 * Bends the /api/* answers of the real app for the tests that need a situation the test store does not have.
 *
 * The happy path runs against the real routes and the test store (packages/casos/test/almacen, see
 * playwright.config.ts): mode `ok` forwards every request untouched. The other modes stand in for the server:
 * failures (401, 500, 503, schema off the contract, connection down), a slow answer, an empty catalog, the contract's
 * examples (a catalog with notes and references), the «real» engine's integer ids, and a synthetic catalog of
 * thousands of systems (no internal data).
 *
 * Unexpected failures (a non-2xx answer while the server is meant to be healthy) are recorded per page: the fixture
 * in explorar.spec.ts fails the test on them. The modes that break the server on purpose record nothing, and a test
 * that expects a 4xx of the real server declares it with `expectApiFailure`.
 */
export type MockMode =
  | "ok"
  | "slow"
  | "401"
  | "500"
  | "503"
  | "down"
  | "schema"
  | "empty"
  | "ejemplo"
  | "large"
  | "enteros";

export interface MockApi {
  /** Changes the answer for the requests that arrive from now on. */
  setMode: (mode: MockMode) => void;
}

interface Answer {
  status: number;
  contentType: string;
  body: string;
}

const SLOW_MS = 5000;
// Playwright loads the tests as CommonJS: paths come from __dirname, not from import.meta.
const EXAMPLES_DIR = path.resolve(__dirname, "../../../../contracts/api/examples");
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const CATALOGO_ROUTE = "/api/catalogo";
const RED_ROUTE = "/api/red";
const GARVER_MOTOR = "jump_misocp";
const GARVER_SISTEMA = "tnep_garver6";
const SYNTHETIC_PER_ENGINE = 1500;
/** The one synthetic system with an accent, a space and a slash in its identifier: the URL must survive it. */
export const SPECIAL_SYSTEM_ID = "SNI año/2032 ñ";
export const SPECIAL_SYSTEM_NAME = "SNI año/2032 ñ (sintético)";
const SYNTHETIC_ENGINES = ["jump_misocp", "fp_dc"] as const;
const SYNTHETIC_DIFFICULTIES = ["rapido", "medio", "pesado"] as const;
/** What the real /api/catalogo answers when the store folder is missing or empty (task 5). */
const EMPTY_CATALOG = { motores: [], aviso: "El almacén de casos no existe o está vacío." };

const unexpected = new WeakMap<Page, string[]>();
const expectedFailure = new WeakSet<Page>();

/** Unexpected failures recorded for a page while the server was meant to answer. Empty when all went as planned. */
export function unexpectedFailures(page: Page): readonly string[] {
  return unexpected.get(page) ?? [];
}

/** The test asks the real server for something it answers with an error (a case that does not exist): not a defect. */
export function expectApiFailure(page: Page): void {
  expectedFailure.add(page);
}

function example(name: string): string {
  return readFileSync(path.join(EXAMPLES_DIR, name), "utf8");
}

const EXAMPLE_CATALOG = example("catalogo.json");
const EXAMPLE_RED = example("red.json");
const RED_ENTEROS = readFileSync(path.join(FIXTURES_DIR, "red-ids-enteros.json"), "utf8");

function json(status: number, body: unknown): Answer {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

function serverError(status: number, codigo: string, mensaje: string): Answer {
  return json(status, { error: { codigo, mensaje } });
}

interface SyntheticSystem {
  id: string;
  nombre: string;
  barras: number;
  dificultad: string;
  nota?: string;
}

function syntheticSystems(engineIndex: number): SyntheticSystem[] {
  return Array.from({ length: SYNTHETIC_PER_ENGINE }, (_, index) => {
    const number = index + 1;
    const system: SyntheticSystem = {
      id: `sint-${String(engineIndex)}-${String(number)}`,
      nombre: `Sistema sintético ${String(number)} · red ñandú`,
      barras: 1 + ((number * 37) % 938),
      dificultad: SYNTHETIC_DIFFICULTIES[number % SYNTHETIC_DIFFICULTIES.length] ?? "medio",
    };
    if (number % 500 === 0) system.nota = "Aviso sintético de prueba.";
    return system;
  });
}

/** The `large` catalog: two engines, 1 500 synthetic systems each, plus the special system. */
function syntheticCatalog(): { motores: unknown[] } {
  return {
    motores: SYNTHETIC_ENGINES.map((id, index) => {
      const sistemas = syntheticSystems(index);
      if (index === 0) {
        sistemas.push({ id: SPECIAL_SYSTEM_ID, nombre: SPECIAL_SYSTEM_NAME, barras: 938, dificultad: "pesado" });
      }
      return { id, nombre: `Motor sintético ${id}`, familia: "convexo", formulacion: "Sintético", sistemas };
    }),
  };
}

function syntheticSystemIds(): Set<string> {
  const ids = new Set<string>([SPECIAL_SYSTEM_ID]);
  for (const system of syntheticSystems(0)) ids.add(system.id);
  return ids;
}

const SYNTHETIC_IDS = syntheticSystemIds();

/** The example case, renamed to the requested identifiers (the case data is Garver 6 in every case). */
function syntheticCase(engine: string, system: string, tec: string | null, nombre: string): Answer {
  const red = JSON.parse(EXAMPLE_RED) as Record<string, unknown>;
  return json(200, { ...red, motor: engine, sistema: system, nombre_sistema: nombre, tec });
}

/** The answer a mode gives instead of the server's, or undefined to forward the request to the real app. */
function answerFor(url: URL, mode: MockMode): Answer | undefined {
  const route = url.pathname;
  switch (mode) {
    case "401":
      return serverError(401, "sesion_requerida", "Sesión requerida");
    case "500":
      return serverError(500, "error_interno", "Error interno");
    case "503":
      return serverError(503, "almacen_no_disponible", "El almacén de casos no está disponible; se reintentará.");
    case "schema":
      // A catalog that is not an object with «motores», and a network without «barras»: off the contract.
      return route === RED_ROUTE
        ? json(200, { esquema: "misocp", ac_existentes: [] })
        : json(200, { motores: "no es una lista" });
    case "empty":
      return route === CATALOGO_ROUTE ? json(200, EMPTY_CATALOG) : undefined;
    case "ejemplo":
      return route === CATALOGO_ROUTE ? { status: 200, contentType: "application/json", body: EXAMPLE_CATALOG } : undefined;
    case "large":
      return largeAnswer(url);
    case "enteros":
      return route === RED_ROUTE ? { status: 200, contentType: "application/json", body: RED_ENTEROS } : undefined;
    default:
      return undefined;
  }
}

function largeAnswer(url: URL): Answer | undefined {
  if (url.pathname === CATALOGO_ROUTE) return json(200, syntheticCatalog());
  if (url.pathname !== RED_ROUTE) return undefined;
  const engine = url.searchParams.get("motor");
  const system = url.searchParams.get("sistema");
  const tec = url.searchParams.get("tec");
  if (system !== null && SYNTHETIC_IDS.has(system)) {
    const nombre = system === SPECIAL_SYSTEM_ID ? SPECIAL_SYSTEM_NAME : `Sistema sintético ${system}`;
    return syntheticCase(engine ?? "", system, tec, nombre);
  }
  return engine === GARVER_MOTOR && system === GARVER_SISTEMA ? undefined : serverError(404, "caso_no_encontrado", "No existe el caso pedido.");
}

function isServerHealthy(mode: MockMode): boolean {
  return ["ok", "ejemplo", "large", "slow", "enteros", "empty"].includes(mode);
}

/**
 * Routes every /api/* request of the page through the mock. The handler reads the mode on each request, so a test
 * can break the server and restore it without reloading. A non-2xx answer while the server is healthy is recorded.
 */
export async function mockApi(page: Page, initial: MockMode = "ok"): Promise<MockApi> {
  let mode: MockMode = initial;
  unexpected.set(page, []);

  // Only the server routes: in dev, workspace packages such as packages/api/ are also served under /…/api/.
  await page.route(
    (url) => url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/"),
    async (route: Route) => {
      const current = mode;
      const url = new URL(route.request().url());
      if (current === "down") {
        await route.abort("connectionrefused");
        return;
      }
      if (current === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      const answer = answerFor(url, current);
      if (answer === undefined) {
        // The real app answers. The page may already be closed by then (a test that ended, a slow answer).
        const response = await route.fetch().catch(() => undefined);
        if (response === undefined) return;
        if (response.status() >= 300 && isServerHealthy(current) && !expectedFailure.has(page)) {
          unexpected.get(page)?.push(`${String(response.status())} ${url.pathname}${url.search}`);
        }
        await route.fulfill({ response }).catch(() => undefined);
        return;
      }
      if (answer.status >= 300 && isServerHealthy(current) && !expectedFailure.has(page)) {
        unexpected.get(page)?.push(`${String(answer.status)} ${url.pathname}${url.search}`);
      }
      await route.fulfill(answer).catch(() => undefined);
    },
  );

  return {
    setMode: (next) => {
      mode = next;
    },
  };
}
