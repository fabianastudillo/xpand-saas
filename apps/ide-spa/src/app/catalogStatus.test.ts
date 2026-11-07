import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/messages";
import { catalogStatusMessage } from "./catalogStatus";

const ES = createTranslator("es");
const EN = createTranslator("en");
const CATALOG = { motores: [{ id: "a", nombre: "A", familia: "f", sistemas: [{ id: "s", nombre: "S", barras: 6 }] }] };

describe("catalogStatusMessage", () => {
  it("says it is loading while there is neither data nor error", () => {
    expect(catalogStatusMessage({ data: undefined, isError: false }, ES)).toBe("Cargando…");
  });

  it("counts the systems once the catalog arrived", () => {
    expect(catalogStatusMessage({ data: CATALOG, isError: false }, ES)).toBe("Catálogo: 1 sistemas");
  });

  it("says the catalog is not available when the request failed, never «Cargando…»", () => {
    expect(catalogStatusMessage({ data: undefined, isError: true }, ES)).toBe("Catálogo no disponible. Revisa «Problemas».");
    expect(catalogStatusMessage({ data: undefined, isError: true }, EN)).toBe("Catalog unavailable. Check “Problems”.");
  });
});
