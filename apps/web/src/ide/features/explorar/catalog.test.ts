import type { Catalogo, Sistema } from "@xpand/api";
import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  familiesOfCatalog,
  filtersFromSearch,
  filtersToParams,
  filterEntries,
  catalogEntries,
  referenceFor,
  sizeOf,
  type CatalogFilters,
} from "./catalog";

const CATALOGO: Catalogo = {
  motores: [
    {
      id: "jump_misocp",
      nombre: "MISOCP AC/DC",
      familia: "convexo",
      sistemas: [
        { id: "tnep_garver6", nombre: "Garver 6", barras: 6, dificultad: "rapido" },
        { id: "tnep_ieee24", nombre: "IEEE 24 barras", barras: 24, referencias: [{ valor: 86 }] },
      ],
    },
    {
      id: "fp_dc",
      nombre: "FlexPlan DC",
      formulacion: "Formulación de prueba",
      sistemas: [{ id: "sni_2032", nombre: "SNI año/2032 ñ", barras: 938 }],
    },
  ],
};

const ENTRADAS = catalogEntries(CATALOGO);

function filtrar(filters: Partial<CatalogFilters>): string[] {
  return filterEntries(ENTRADAS, { ...EMPTY_FILTERS, ...filters }).map((entry) => entry.system.id);
}

describe("entradasDelCatalogo", () => {
  it("lists every system with its motor, in catalog order", () => {
    expect(ENTRADAS.map((entry) => `${entry.engine.id}/${entry.system.id}`)).toEqual([
      "jump_misocp/tnep_garver6",
      "jump_misocp/tnep_ieee24",
      "fp_dc/sni_2032",
    ]);
  });
});

describe("filtrarEntradas", () => {
  it("returns everything without filters", () => {
    expect(filtrar({})).toEqual(["tnep_garver6", "tnep_ieee24", "sni_2032"]);
  });

  it("matches every word of the text, ignoring case and accents", () => {
    expect(filtrar({ text: "GARVER 6" })).toEqual(["tnep_garver6"]);
    expect(filtrar({ text: "ano 2032" })).toEqual(["sni_2032"]);
    expect(filtrar({ text: "garver ieee" })).toEqual([]);
  });

  it("filters by motor", () => {
    expect(filtrar({ engine: "fp_dc" })).toEqual(["sni_2032"]);
  });

  it("filters by the formulation family of the motor (field familia)", () => {
    expect(filtrar({ family: "convexo" })).toEqual(["tnep_garver6", "tnep_ieee24"]);
  });

  it("filters by size in buses: small up to 20, medium up to 100, large above", () => {
    expect(filtrar({ size: "small" })).toEqual(["tnep_garver6"]);
    expect(filtrar({ size: "medium" })).toEqual(["tnep_ieee24"]);
    expect(filtrar({ size: "large" })).toEqual(["sni_2032"]);
  });
});

describe("tamanoDe", () => {
  it("places the limits in the right band", () => {
    expect(sizeOf(20)).toBe("small");
    expect(sizeOf(21)).toBe("medium");
    expect(sizeOf(100)).toBe("medium");
    expect(sizeOf(101)).toBe("large");
  });
});

describe("referenceFor", () => {
  // The seven references of Garver 6 as the server publishes them (contracts/api/examples/catalogo.json), reordered.
  const system: Sistema = {
    id: "tnep_garver6",
    nombre: "Garver 6",
    barras: 6,
    referencias: [
      { tecnologias: "ac,hvdc", valor: 2970.32 },
      { tecnologias: "ac,bancos", valor: 4201.3 },
      { tecnologias: "ac", valor: 6212.4547 },
      { formulacion: "sin tecnologías", valor: 1 },
    ],
  };

  it("picks the reference whose technologies are exactly the ones the case is opened with", () => {
    expect(referenceFor(system, ["ac"])).toBe(6212.4547);
    expect(referenceFor(system, ["hvdc", "ac"])).toBe(2970.32);
  });

  it("gives nothing when no reference names those technologies, or none says which it is", () => {
    expect(referenceFor(system, ["ac", "bess"])).toBeUndefined();
    expect(referenceFor({ id: "x", nombre: "x", barras: 1, referencias: [{ valor: 5 }] }, ["ac"])).toBeUndefined();
    expect(referenceFor({ id: "x", nombre: "x", barras: 1 }, ["ac"])).toBeUndefined();
  });
});

describe("familiesOfCatalog", () => {
  it("lists each formulation family once, taken from the field familia", () => {
    expect(familiesOfCatalog(CATALOGO)).toEqual(["convexo"]);
  });
});

describe("filtersToSearch and filtersFromSearch", () => {
  it("writes only the filters in use and reads them back unchanged", () => {
    // Arrange
    const filters: CatalogFilters = { text: "sni año", engine: "fp_dc", family: null, size: "large" };

    // Act
    const search = filtersToParams(filters).toString();
    const back = filtersFromSearch(new URLSearchParams(search));

    // Assert
    expect(search).toBe("q=sni+a%C3%B1o&engine=fp_dc&size=large");
    expect(back).toEqual(filters);
  });

  it("ignores unknown size values coming from the address bar", () => {
    expect(filtersFromSearch(new URLSearchParams("size=enorme")).size).toBeNull();
  });

  it("writes an empty search when nothing is filtered", () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe("");
  });
});
