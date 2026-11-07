import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { mockApi } from "./mock-api";

const ORIGIN = "http://127.0.0.1:4173";
const CATALOG_PATH = "/app/";
const CASE_PATH = "/app/casos/jump_misocp/tnep_garver6";
const VIEWPORT_1024 = { width: 1024, height: 768 };
const VIEWPORT_1440 = { width: 1440, height: 900 };
const VIEWPORT_PHONE = { width: 360, height: 640 };
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SNAPSHOT_OPTIONS = { animations: "disabled", maxDiffPixelRatio: 0.02 } as const;
const SLOW_LOAD_TIMEOUT_MS = 15_000;

/**
 * Every test also checks what the user cannot see: console errors, page errors, failed or error responses
 * (the fonts above all), and any request that leaves the local origin. /api/* failures are expected in the
 * tests that break the server on purpose, so they are not reported here.
 */
const test = base.extend<{ watched: string[] }>({
  watched: [
    async ({ page }, use) => {
      const problems: string[] = [];
      await page.route((url) => !url.href.startsWith(ORIGIN), (route) => {
        problems.push(`request outside the local origin: ${route.request().url()}`);
        return route.abort();
      });
      page.on("console", (message) => {
        if (message.type() === "error" && !message.location().url.includes("/api/")) {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        problems.push(`page error: ${error.message}`);
      });
      page.on("requestfailed", (request) => {
        if (!request.url().includes("/api/")) problems.push(`failed request: ${request.url()}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400 && !response.url().includes("/api/")) {
          problems.push(`HTTP ${String(response.status())}: ${response.url()}`);
        }
      });
      await use(problems);
      expect(problems, "console, network or page errors").toEqual([]);
    },
    { auto: true },
  ],
});

function treeOfCase(page: Page): Locator {
  return page.getByRole("tree", { name: "Árbol del caso" });
}

function problemsOf(page: Page): Locator {
  return page.getByRole("group", { name: "Lista de problemas" });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in pixels").toBeLessThanOrEqual(0);
}

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  const found = results.violations.map((violation) => `${violation.id}: ${violation.help}`);
  expect(found, "axe violations").toEqual([]);
}

test.describe("Explorar casos", () => {
  test("con teclado: filtra el catálogo, abre el caso y selecciona la barra 2", async ({ page }) => {
    await mockApi(page);
    await page.goto(CATALOG_PATH);

    const search = page.getByRole("searchbox", { name: "Buscar sistema" });
    await expect(search).toBeFocused();
    // Enter opens the first system of the list, so the list must have arrived before the user presses it.
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await page.keyboard.type("garver");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/app\/casos\/jump_misocp\/tnep_garver6$/);
    const barras = treeOfCase(page).getByRole("treeitem", { name: /^Barras/ });
    await expect(barras).toBeFocused();
    await expect(barras).toContainText("6");

    await page.keyboard.press("ArrowDown"); // Barra 1
    await page.keyboard.press("ArrowDown"); // Barra 2
    const barra2 = treeOfCase(page).getByRole("treeitem", { name: "Barra 2", exact: true });
    await expect(barra2).toBeFocused();
    await page.keyboard.press("Enter");

    const inspector = page.getByRole("group", { name: /Propiedades/ });
    await expect(inspector).toContainText("Barra 2");
    // Garver 6 bus 2 has a load of 240 MW in contracts/api/examples/red.json (the brief said 340,0).
    await expect(inspector).toContainText("240,0 MW");
  });

  test("mientras carga muestra el esqueleto y la paleta de comandos sigue abriéndose", async ({ page }) => {
    test.setTimeout(SLOW_LOAD_TIMEOUT_MS * 2);
    await mockApi(page, "slow");
    await page.goto(CATALOG_PATH);

    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
    // While the palette is open the page behind it is hidden from the accessibility tree: close it to see the list.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible({ timeout: SLOW_LOAD_TIMEOUT_MS });
  });

  test("con 401 «Problemas» explica la sesión y enlaza a la interfaz clásica", async ({ page }) => {
    await mockApi(page, "401");
    await page.goto(CATALOG_PATH);

    await expect(problemsOf(page)).toContainText("Sesión requerida");
    await expect(page.getByRole("link", { name: "Abrir la interfaz clásica" })).toHaveAttribute("href", "/");
  });

  test("con el servidor caído muestra el error con «Reintentar» y carga al reintentar", async ({ page }) => {
    const mock = await mockApi(page, "down");
    await page.goto(CATALOG_PATH);

    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible({ timeout: SLOW_LOAD_TIMEOUT_MS });
    await expect(problemsOf(page)).toContainText("Sin conexión");

    mock.setMode("ok");
    await retry.click();
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  });

  test("recargar el caso lo mantiene abierto", async ({ page }) => {
    await mockApi(page);
    await page.goto(CASE_PATH);
    await expect(treeOfCase(page).getByRole("treeitem", { name: /^Barras/ })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`${CASE_PATH}$`));
    await expect(treeOfCase(page).getByRole("treeitem", { name: /^Barras/ })).toContainText("6");
    await expect(page.getByRole("heading", { name: /Garver 6/, level: 1 })).toHaveCount(1);
  });

  for (const [label, viewport] of [
    ["1024", VIEWPORT_1024],
    ["1440", VIEWPORT_1440],
  ] as const) {
    test(`capturas de regresión a ${label} px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockApi(page);

      await page.goto(CATALOG_PATH);
      await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`catalogo-${label}.png`, SNAPSHOT_OPTIONS);

      await page.goto(CASE_PATH);
      await expect(treeOfCase(page).getByRole("treeitem", { name: /^Barras/ })).toBeVisible();
      await expect(page).toHaveScreenshot(`caso-${label}.png`, SNAPSHOT_OPTIONS);
    });
  }

  test("sin violaciones AA de axe en el catálogo y en el caso", async ({ page }) => {
    await mockApi(page);

    await page.goto(CATALOG_PATH);
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await expectNoViolations(page);

    await page.goto(CASE_PATH);
    await expect(treeOfCase(page).getByRole("treeitem", { name: /^Barras/ })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a 360 px los cajones se abren y se cierran, y la página no se desborda", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PHONE);
    await mockApi(page);
    await page.goto(CASE_PATH);
    // Narrow screens start with the side zones collapsed: the tree is mounted but hidden until the drawer opens.
    await expect(page.locator('[data-slot="case-tree"]')).toBeAttached();

    const explorer = page.getByRole("complementary", { name: "Explorador del caso" });
    const explorerToggle = page.getByRole("button", { name: "Explorador", exact: true });
    await expect(explorer).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await explorerToggle.click();
    await expect(explorer).toBeVisible();
    await expect(explorerToggle).toHaveAttribute("aria-expanded", "true");
    await expect(treeOfCase(page).getByRole("treeitem", { name: /^Barras/ })).toBeVisible();
    await page.locator('[data-slot="shell-overlay"]').click({ position: { x: 340, y: 200 } });
    await expect(explorer).toBeHidden();

    await explorerToggle.click();
    await page.getByRole("button", { name: "Cerrar explorador" }).click();
    await expect(explorer).toBeHidden();

    await explorerToggle.click();
    await expect(explorer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(explorer).toBeHidden();

    const inspector = page.getByRole("complementary", { name: "Inspector" });
    const inspectorToggle = page.getByRole("button", { name: "Inspector", exact: true });
    await inspectorToggle.click();
    await expect(inspector).toBeVisible();
    await page.getByRole("button", { name: "Cerrar inspector" }).click();
    await expect(inspector).toBeHidden();

    await expectNoHorizontalOverflow(page);
  });
});
