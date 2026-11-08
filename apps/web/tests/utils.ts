import { expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const testAccessibilityFor = async (url: string, page: Page) => {
  await page.goto(url);
  // Pages behind a loading.tsx stream their content and React reveals it a moment later: scan once the page's
  // level-one heading (which axe requires anyway) is on screen, not while the loading fallback shows.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
};

/** Hosts the browser may talk to: the app itself (Next addresses the loopback as `localhost`). */
const HOSTS_PROPIOS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface VigilanciaTerceros {
  /** Console errors and uncaught page errors, with the URL of the page that produced them. */
  erroresConsola: string[];
  /** HTTP requests and WebSocket connections to any host other than the app's own. */
  peticionesExternas: string[];
}

/**
 * Records, for the whole life of `page`, every console error and every HTTP/WebSocket request to a host that is
 * not the app's own. Used to prove that, without third-party keys, no page talks to Stripe, Google, Crisp or any
 * other external service and nothing breaks in the console.
 */
export const vigilarTerceros = (page: Page): VigilanciaTerceros => {
  const vigilancia: VigilanciaTerceros = {
    erroresConsola: [],
    peticionesExternas: [],
  };
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") {
      vigilancia.erroresConsola.push(`${page.url()}: ${mensaje.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    vigilancia.erroresConsola.push(`${page.url()}: ${error.message}`);
  });
  const esExterna = (destino: string) => {
    const url = new URL(destino);
    return (
      /^(https?|wss?):$/.test(url.protocol) && !HOSTS_PROPIOS.has(url.hostname)
    );
  };
  page.on("request", (peticion) => {
    if (esExterna(peticion.url())) {
      vigilancia.peticionesExternas.push(`${page.url()} -> ${peticion.url()}`);
    }
  });
  page.on("websocket", (socket) => {
    if (esExterna(socket.url())) {
      vigilancia.peticionesExternas.push(
        `${page.url()} -> ${socket.url()} (websocket)`,
      );
    }
  });
  return vigilancia;
};

/** Loads `url`, waits for the network to settle and for hydration, and asserts the page rendered something. */
export const cargarPaginaVigilada = async (url: string, page: Page) => {
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.locator("body")).not.toBeEmpty();
  // Give client components a moment to hydrate and fire any deferred third-party script.
  await page.waitForTimeout(500);
};
