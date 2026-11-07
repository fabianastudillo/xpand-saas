import { test, expect } from "@playwright/test";

import { cargarPaginaVigilada, vigilarTerceros } from "../utils";

// With Stripe, Google and outgoing mail unconfigured (.env.test leaves every third-party key empty), the
// public pages must load without console errors and without a single request to a host other than the app's.
const PAGINAS_PUBLICAS = ["/", "/pricing", "/privacy", "/terms", "/login"];

test.describe("Public pages without third-party keys", () => {
  for (const ruta of PAGINAS_PUBLICAS) {
    test(`${ruta} loads with no console errors and no external requests`, async ({ page }) => {
      const vigilancia = vigilarTerceros(page);

      await cargarPaginaVigilada(ruta, page);

      expect(vigilancia.erroresConsola).toEqual([]);
      expect(vigilancia.peticionesExternas).toEqual([]);
    });
  }

  test("/login offers no sign-in provider that is not configured", async ({ page }) => {
    await cargarPaginaVigilada("/login", page);

    await expect(page.getByRole("button", { name: /sign in with email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with google/i })).toHaveCount(0);
  });
});
