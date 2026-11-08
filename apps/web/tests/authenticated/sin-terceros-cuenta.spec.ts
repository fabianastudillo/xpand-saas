import { test, expect } from "@playwright/test";

import { adminUser } from "../data/admin-user";
import { normalUser } from "../data/normal-user";
import { cargarPaginaVigilada, vigilarTerceros } from "../utils";

// Same contract as tests/unauthenticated/sin-terceros.spec.ts, for the account pages: without third-party keys
// the user and admin areas load with no console errors and no requests outside the app.
const PAGINAS_USUARIO = ["/dashboard", "/profile"];
const PAGINAS_ADMIN = [
  "/admin/dashboard",
  "/admin/dashboard/user-management",
  "/admin/dashboard/feature-flags",
];

test.describe("User pages without third-party keys", () => {
  test.use({ storageState: normalUser.storageSessionPath });

  for (const ruta of PAGINAS_USUARIO) {
    test(`${ruta} loads with no console errors and no external requests`, async ({ page }) => {
      const vigilancia = vigilarTerceros(page);

      await cargarPaginaVigilada(ruta, page);

      expect(vigilancia.erroresConsola).toEqual([]);
      expect(vigilancia.peticionesExternas).toEqual([]);
    });
  }
});

test.describe("Admin pages without third-party keys", () => {
  test.use({ storageState: adminUser.storageSessionPath });

  for (const ruta of PAGINAS_ADMIN) {
    test(`${ruta} loads with no console errors and no external requests`, async ({ page }) => {
      const vigilancia = vigilarTerceros(page);

      await cargarPaginaVigilada(ruta, page);

      expect(vigilancia.erroresConsola).toEqual([]);
      expect(vigilancia.peticionesExternas).toEqual([]);
    });
  }
});
