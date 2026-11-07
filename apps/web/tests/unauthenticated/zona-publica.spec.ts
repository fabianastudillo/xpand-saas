import { test, expect, type Page } from "@playwright/test";

import { vigilarTerceros } from "../utils";

// The public zone identifies XPAND and says only what the platform does today (spec §6.1, ruling R20): no filler
// text of the template, no invented prices or trials, no legal pages with placeholders. The check reads the whole
// HTML (scripts and the serialized props of the page included), not only what is visible.
const PAGINAS_PUBLICAS = ["/", "/pricing", "/privacy", "/terms", "/login"];
const RELLENO_PROHIBIDO = [/lorem/i, /open micro saas/i, /\[your/i, /your_price_id/i, /14-day/i];

const htmlDe = async (ruta: string, page: Page): Promise<string> => {
  await page.goto(ruta);
  return page.content();
};

test.describe("Public zone: XPAND and nothing invented", () => {
  for (const ruta of PAGINAS_PUBLICAS) {
    test(`${ruta} has no filler text, invented prices or placeholders`, async ({ page, request }) => {
      const renderizado = await htmlDe(ruta, page);
      const servido = await (await request.get(ruta)).text();

      for (const patron of RELLENO_PROHIBIDO) {
        expect(renderizado, `${ruta} (rendered) contains ${String(patron)}`).not.toMatch(patron);
        expect(servido, `${ruta} (served) contains ${String(patron)}`).not.toMatch(patron);
      }
    });
  }

  test("the home page says what XPAND is and leads to the cases and to sign in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("XPAND");
    await expect(page.getByRole("heading", { level: 1, name: "XPAND" })).toBeVisible();
    await expect(page.getByText(/planificador de expansión de sistemas eléctricos/i).first()).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Explorar casos" })).toHaveAttribute("href", "/casos");
    await expect(page.getByRole("main").getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  test("no link of the home page leads nowhere", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test("without payments, prices are not shown: no section, no link, and /pricing is a 404", async ({ page, request }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /pricing|precios/i })).toHaveCount(0);
    await expect(page.getByText(/USD|\$\s?\d/)).toHaveCount(0);
    expect((await request.get("/pricing")).status()).toBe(404);
  });

  test("/pricing without payments explains, in the site's own page, that there is no such page", async ({ page }) => {
    const vigilancia = vigilarTerceros(page);

    const response = await page.goto("/pricing", { waitUntil: "networkidle" });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explorar casos" }).last()).toHaveAttribute("href", "/casos");
    // The browser logs the 404 of the document itself; nothing else (no nested <html>, no hydration error).
    const otros = vigilancia.erroresConsola.filter((error) => !/Failed to load resource.*404/.test(error));
    expect(otros).toEqual([]);
    expect(vigilancia.peticionesExternas).toEqual([]);
  });

  for (const ruta of ["/privacy", "/terms"]) {
    test(`${ruta} is a short provisional draft that says what the platform keeps today`, async ({ page }) => {
      await page.goto(ruta);

      await expect(page.getByText("Borrador provisional", { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/correo/i).first()).toBeVisible();
    });
  }
});
