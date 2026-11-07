import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

/**
 * Stands in for the Julia server during the e2e runs. Every /api/* request is answered from the examples of
 * contracts/api (Garver 6), except in the `large` mode, where the catalog is synthetic (generated here, with the
 * shape of the contract, no internal data). The failure modes are switchable at runtime.
 *
 * Unexpected failures (a non-2xx answer while the server is meant to be healthy) are recorded per page: the
 * fixture in explorar.spec.ts fails the test on them. The modes 401, 500 and down are the expected failures of
 * their own tests, so they record nothing.
 */

/**
 * `enteros`: the case comes in the shape of the «real» engine of the server (fixtures/red-ids-enteros.json): integer
 * bus ids and line ends, buses without «nombre». The contract admits it; the interface must read it as text.
 */
export type MockMode = "ok" | "slow" | "401" | "500" | "down" | "large" | "enteros";

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
const EXAMPLES_DIR = new URL("../../../contracts/api/examples/", import.meta.url);
const FIXTURES_DIR = new URL("./fixtures/", import.meta.url);
const CATALOGO_ROUTE = "/api/catalogo";
const RED_ROUTE = "/api/red";
const CONFIG_ROUTE = "/api/config";
const SESION_ROUTE = "/api/sesion";
const GARVER_MOTOR = "jump_misocp";
const GARVER_SISTEMA = "tnep_garver6";
const GARVER_TEC = "ac";
const SYNTHETIC_PER_ENGINE = 1500;
/** The one synthetic system with an accent, a space and a slash in its identifier: the URL must survive it. */
export const SPECIAL_SYSTEM_ID = "SNI año/2032 ñ";
export const SPECIAL_SYSTEM_NAME = "SNI año/2032 ñ (sintético)";
const SYNTHETIC_ENGINES = ["jump_misocp", "fp_dc"] as const;
const SYNTHETIC_DIFFICULTIES = ["rapido", "medio", "pesado"] as const;

const unexpected = new WeakMap<Page, string[]>();

/** Unexpected failures recorded for a page while the server was meant to answer. Empty when all went as planned. */
export function unexpectedFailures(page: Page): readonly string[] {
  return unexpected.get(page) ?? [];
}

function example(name: string): string {
  return readFileSync(new URL(name, EXAMPLES_DIR), "utf8");
}

const EXAMPLES: Readonly<Record<string, string>> = {
  [CATALOGO_ROUTE]: example("catalogo.json"),
  [RED_ROUTE]: example("red.json"),
  [CONFIG_ROUTE]: example("config.json"),
  [SESION_ROUTE]: example("sesion.json"),
};
const RED_ENTEROS = readFileSync(new URL("red-ids-enteros.json", FIXTURES_DIR), "utf8");

function json(status: number, body: unknown): Answer {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
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
function caseAnswer(engine: string, system: string, tec: string | null, nombre: string): Answer {
  const red: Record<string, unknown> = JSON.parse(EXAMPLES[RED_ROUTE] ?? "{}") as Record<string, unknown>;
  return json(200, { ...red, motor: engine, sistema: system, nombre_sistema: nombre, tec });
}

function answerRed(url: URL, mode: MockMode): Answer {
  const engine = url.searchParams.get("motor");
  const system = url.searchParams.get("sistema");
  const tec = url.searchParams.get("tec");
  if (mode === "large" && system !== null && SYNTHETIC_IDS.has(system)) {
    const nombre = system === SPECIAL_SYSTEM_ID ? SPECIAL_SYSTEM_NAME : `Sistema sintético ${system}`;
    return caseAnswer(engine ?? "", system, tec, nombre);
  }
  const matches = engine === GARVER_MOTOR && system === GARVER_SISTEMA && tec === GARVER_TEC;
  if (!matches) return json(404, { error: "Caso no encontrado" });
  const body = mode === "enteros" ? RED_ENTEROS : (EXAMPLES[RED_ROUTE] ?? "{}");
  return { status: 200, contentType: "application/json", body };
}

/** The answer for a request that the healthy server would give. */
function answerOk(url: URL, mode: MockMode): Answer {
  const route = url.pathname;
  if (route === RED_ROUTE) return answerRed(url, mode);
  if (route === CATALOGO_ROUTE && mode === "large") return json(200, syntheticCatalog());
  const body = EXAMPLES[route];
  if (body === undefined) return json(404, { error: "Ruta no simulada" });
  return { status: 200, contentType: "application/json", body };
}

function failure(mode: "401" | "500"): Answer {
  return mode === "401" ? json(401, { error: "Sesión requerida" }) : json(500, { error: "Error interno" });
}

function isServerHealthy(mode: MockMode): boolean {
  return mode === "ok" || mode === "large" || mode === "slow" || mode === "enteros";
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
    (url) => url.pathname.startsWith("/api/"),
    async (route: Route) => {
      const current = mode;
      const url = new URL(route.request().url());
      if (current === "down") {
        await route.abort("connectionrefused");
        return;
      }
      if (current === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      if (current === "401" || current === "500") {
        await route.fulfill(failure(current));
        return;
      }
      const answer = answerOk(url, current);
      if (answer.status >= 300 && isServerHealthy(current)) {
        unexpected.get(page)?.push(`${String(answer.status)} ${url.pathname}${url.search}`);
      }
      // The page may already be closed when a slow answer arrives; nothing is left to answer then.
      await route.fulfill(answer).catch(() => undefined);
    },
  );

  return {
    setMode: (next) => {
      mode = next;
    },
  };
}
