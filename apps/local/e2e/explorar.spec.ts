import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { mockApi, SPECIAL_SYSTEM_ID, unexpectedFailures } from "./mock-api";

const ORIGIN = "http://127.0.0.1:4173";
const CATALOG_PATH = "/app/";
const CASE_PATH = "/app/casos/jump_misocp/tnep_garver6";
const SPECIAL_CASE_PATH = `/app/casos/jump_misocp/${encodeURIComponent(SPECIAL_SYSTEM_ID)}`;
const VIEWPORT_1024 = { width: 1024, height: 768 };
const VIEWPORT_1440 = { width: 1440, height: 900 };
const VIEWPORT_PHONE = { width: 360, height: 640 };
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SNAPSHOT_OPTIONS = { animations: "disabled", maxDiffPixelRatio: 0.01 } as const;
const SLOW_LOAD_TIMEOUT_MS = 15_000;
const SYNTHETIC_TOTAL = 3001;
/** A catalog window is ~8 rows plus overscan: the DOM must stay far below the 3 001 systems. */
const MAX_RENDERED_ROWS = 60;
const ARROW_STEPS_PAST_FIRST_WINDOW = 80;

/**
 * Every test also checks what the user cannot see: console errors, page errors, failed requests, HTTP errors outside
 * /api/, requests that leave the local origin, and unexpected failures of the mocked server (mockApi records them
 * while the server is meant to be healthy). The tests of 401, 500 and «down» break the server on purpose; their
 * own expectations cover those answers.
 */
const test = base.extend<{ watched: string[] }>({
  watched: [
    async ({ page }, use) => {
      const problems: string[] = [];
      await page.route(
        (url) => !url.href.startsWith(ORIGIN),
        (route) => {
          problems.push(`request outside the local origin: ${route.request().url()}`);
          return route.abort();
        },
      );
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
      expect(unexpectedFailures(page), "unexpected API failures").toEqual([]);
    },
    { auto: true },
  ],
});

function caseTree(page: Page): Locator {
  return page.getByRole("tree", { name: "Árbol del caso" });
}

function problemList(page: Page): Locator {
  return page.getByRole("group", { name: "Lista de problemas" });
}

function catalogList(page: Page): Locator {
  return page.getByRole("list", { name: "Sistemas" });
}

function firstBusItem(page: Page): Locator {
  return caseTree(page).getByRole("treeitem", { name: /^Barras/ });
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

test.describe("Explore cases", () => {
  test("keyboard only: filters the catalog, opens the case and selects bus 2", async ({ page }) => {
    await mockApi(page);
    await page.goto(CATALOG_PATH);

    const search = page.getByRole("searchbox", { name: "Buscar sistema" });
    await expect(search).toBeFocused();
    // Enter opens the first system of the list, so the list must have arrived before the user presses it.
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await page.keyboard.type("garver");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/app\/casos\/jump_misocp\/tnep_garver6$/);
    await expect(firstBusItem(page)).toBeFocused();
    await expect(firstBusItem(page)).toContainText("6");

    await page.keyboard.press("ArrowDown"); // Bus 1
    await page.keyboard.press("ArrowDown"); // Bus 2
    const bus2 = caseTree(page).getByRole("treeitem", { name: "Barra 2", exact: true });
    await expect(bus2).toBeFocused();
    await page.keyboard.press("Enter");

    const inspector = page.getByRole("group", { name: /Propiedades/ });
    await expect(inspector).toContainText("Barra 2");
    // Garver 6 bus 2 has a load of 240 MW in contracts/api/examples/red.json (the brief said 340,0).
    await expect(inspector).toContainText("240,0 MW");
  });

  test("slow answer: shows the skeleton while the palette still opens", async ({ page }) => {
    test.setTimeout(SLOW_LOAD_TIMEOUT_MS * 2);
    await mockApi(page, "slow");
    await page.goto(CATALOG_PATH);

    const loading = page.locator('[data-slot="catalog-loading"]');
    await expect(loading).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
    // While the palette is open the page behind it is hidden from the accessibility tree: close it to see the list.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible({ timeout: SLOW_LOAD_TIMEOUT_MS });
  });

  test("session missing (401): explains it and links to the classic interface", async ({ page }) => {
    await mockApi(page, "401");
    await page.goto(CATALOG_PATH);

    await expect(problemList(page)).toContainText("Sesión requerida");
    await expect(page.getByRole("link", { name: "Abrir la interfaz clásica" })).toHaveAttribute("href", "/");
  });

  test("server down: shows the error with Retry, and loads after retrying", async ({ page }) => {
    const mock = await mockApi(page, "down");
    await page.goto(CATALOG_PATH);

    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible({ timeout: SLOW_LOAD_TIMEOUT_MS });
    await expect(problemList(page)).toContainText("Sin conexión");

    mock.setMode("ok");
    await retry.click();
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  });

  test("server error (500): names the HTTP status, and loads after retrying", async ({ page }) => {
    const mock = await mockApi(page, "500");
    await page.goto(CATALOG_PATH);

    await expect(problemList(page)).toContainText("El servidor respondió con error");
    await expect(problemList(page)).toContainText("HTTP 500");
    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible();

    mock.setMode("ok");
    await retry.click();
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  });

  test("reload keeps the case open", async ({ page }) => {
    await mockApi(page);
    await page.goto(CASE_PATH);
    await expect(firstBusItem(page)).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`${CASE_PATH}$`));
    await expect(firstBusItem(page)).toContainText("6");
    await expect(page).toHaveTitle(/Garver 6/);
  });

  test("sets the document title from the page (WCAG 2.4.2)", async ({ page }) => {
    await mockApi(page);
    await page.goto(CATALOG_PATH);
    await expect(page).toHaveTitle("Catálogo de casos · XPAND");

    await page.goto(CASE_PATH);
    await expect(firstBusItem(page)).toBeVisible();
    await expect(page).toHaveTitle(/^Garver 6 — benchmark .* · XPAND$/);
  });

  test("moving between catalog and case keeps the collapsed panel and does not repeat problems", async ({ page }) => {
    await mockApi(page);
    await page.goto(CASE_PATH);
    await expect(firstBusItem(page)).toBeVisible();
    await expect(problemList(page)).toContainText("Nota del caso");

    await page.keyboard.press("Control+J"); // collapse the bottom panel
    await expect(problemList(page)).toBeHidden();

    await page.getByRole("tab", { name: "Catálogo de casos" }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await page.getByRole("tab", { name: /Garver 6/ }).click();
    await expect(page).toHaveURL(new RegExp(`${CASE_PATH}$`));

    await expect(problemList(page)).toBeHidden();
    await page.keyboard.press("Control+J"); // expand it again: the note is listed once
    await expect(problemList(page).getByText("Nota del caso", { exact: true })).toHaveCount(1);
  });

  for (const [label, viewport] of [
    ["1024", VIEWPORT_1024],
    ["1440", VIEWPORT_1440],
  ] as const) {
    test(`visual regression at ${label} px @visual`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockApi(page);

      await page.goto(CATALOG_PATH);
      await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`catalog-${label}.png`, SNAPSHOT_OPTIONS);

      await page.goto(CASE_PATH);
      await expect(firstBusItem(page)).toBeVisible();
      await expect(page).toHaveScreenshot(`case-${label}.png`, SNAPSHOT_OPTIONS);
    });
  }

  test("no AA axe violations in the catalog and in the case", async ({ page }) => {
    await mockApi(page);

    await page.goto(CATALOG_PATH);
    await expect(page.getByRole("link", { name: /Garver 6/ }).first()).toBeVisible();
    await expectNoViolations(page);

    await page.goto(CASE_PATH);
    await expect(firstBusItem(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test("at 360 px the drawers open and close, and the page does not overflow", async ({ page }) => {
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
    await expect(firstBusItem(page)).toBeVisible();
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

  test("large catalog: bounded DOM, positions, filter with Enter, arrows past the first window", async ({ page }) => {
    await mockApi(page, "large");
    await page.goto(CATALOG_PATH);

    await expect(page.getByText(`Catálogo: ${String(SYNTHETIC_TOTAL)} sistemas`)).toBeVisible();
    const rows = catalogList(page).locator(":scope > li");
    const rendered = await rows.count();
    expect(rendered, "rendered rows").toBeGreaterThan(0);
    expect(rendered, "rendered rows").toBeLessThanOrEqual(MAX_RENDERED_ROWS);
    await expect(rows.first()).toHaveAttribute("aria-posinset", "1");
    await expect(rows.first()).toHaveAttribute("aria-setsize", String(SYNTHETIC_TOTAL));

    // Filter to the one system with an accent, a space and a slash, and open it with Enter.
    await page.getByRole("searchbox", { name: "Buscar sistema" }).fill("2032");
    await expect(catalogList(page).getByRole("link")).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Buscar sistema" }).press("Enter");
    await expect(page).toHaveURL(new RegExp(`${SPECIAL_CASE_PATH}$`));
    await expect(firstBusItem(page)).toBeVisible();

    // Reload the same address: the identifier with accent, space and slash survives the round trip.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${SPECIAL_CASE_PATH}$`));
    await expect(firstBusItem(page)).toBeVisible();
  });

  test("large catalog: arrow keys move the focus past the first window", async ({ page }) => {
    await mockApi(page, "large");
    await page.goto(CATALOG_PATH);
    const rows = catalogList(page).locator(":scope > li");
    await expect(rows.first()).toBeVisible();

    await rows.first().getByRole("link").focus();
    for (let step = 0; step < ARROW_STEPS_PAST_FIRST_WINDOW; step += 1) {
      await page.keyboard.press("ArrowDown");
    }
    const target = ARROW_STEPS_PAST_FIRST_WINDOW + 1;
    await expect(catalogList(page).locator(`:scope > li[aria-posinset="${String(target)}"] a`)).toBeFocused();
    expect(await rows.count(), "rendered rows after scrolling").toBeLessThanOrEqual(MAX_RENDERED_ROWS);
  });
});
