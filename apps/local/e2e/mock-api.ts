import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

/**
 * Stands in for the Julia server during the e2e runs: every /api/* request is answered from the examples of
 * contracts/api (Garver 6), and the failure modes the screens must survive are switchable at runtime.
 */

export type MockMode = "ok" | "slow" | "401" | "500" | "down";

export interface MockApi {
  /** Changes the answer for the requests that arrive from now on. */
  setMode: (mode: MockMode) => void;
}

const SLOW_MS = 5000;
const EXAMPLES_DIR = new URL("../../../contracts/api/examples/", import.meta.url);
const CATALOGO_ROUTE = "/api/catalogo";
const RED_ROUTE = "/api/red";
const CONFIG_ROUTE = "/api/config";
const SESION_ROUTE = "/api/sesion";
const GARVER_MOTOR = "jump_misocp";
const GARVER_SISTEMA = "tnep_garver6";
const GARVER_TEC = "ac";

function example(name: string): string {
  return readFileSync(new URL(name, EXAMPLES_DIR), "utf8");
}

const EXAMPLES: Readonly<Record<string, string>> = {
  [CATALOGO_ROUTE]: example("catalogo.json"),
  [RED_ROUTE]: example("red.json"),
  [CONFIG_ROUTE]: example("config.json"),
  [SESION_ROUTE]: example("sesion.json"),
};

function json(status: number, body: unknown): { status: number; contentType: string; body: string } {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** The example answer for a request, or a 404 when the query names a case the examples do not have. */
function answerOk(url: URL): { status: number; contentType: string; body: string } {
  const route = url.pathname;
  if (route === RED_ROUTE) {
    const matches =
      url.searchParams.get("motor") === GARVER_MOTOR &&
      url.searchParams.get("sistema") === GARVER_SISTEMA &&
      url.searchParams.get("tec") === GARVER_TEC;
    if (!matches) return json(404, { error: "Caso no encontrado" });
  }
  const body = EXAMPLES[route];
  if (body === undefined) return json(404, { error: "Ruta no simulada" });
  return { status: 200, contentType: "application/json", body };
}

/**
 * Routes every /api/* request of the page through the given mock. The handler reads the mode on each request,
 * so a test can break the server, then restore it, without reloading the page.
 */
export async function mockApi(page: Page, initial: MockMode = "ok"): Promise<MockApi> {
  let mode: MockMode = initial;

  // Only the server routes: in dev, workspace packages such as packages/api/ are also served under /…/api/.
  await page.route((url) => url.pathname.startsWith("/api/"), async (route: Route) => {
    const current = mode;
    if (current === "down") {
      await route.abort("connectionrefused");
      return;
    }
    if (current === "slow") {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    }
    if (current === "401") {
      await route.fulfill(json(401, { error: "Sesión requerida" }));
      return;
    }
    if (current === "500") {
      await route.fulfill(json(500, { error: "Error interno" }));
      return;
    }
    // The page may already be closed when a slow answer arrives; nothing is left to answer then.
    await route.fulfill(answerOk(new URL(route.request().url()))).catch(() => undefined);
  });

  return {
    setMode: (next) => {
      mode = next;
    },
  };
}
