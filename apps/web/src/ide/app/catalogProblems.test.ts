import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/messages";
import { catalogProblems } from "./catalogProblems";

const ES = createTranslator("es");
const EN = createTranslator("en");
const SYSTEM = { id: "s", nombre: "S", barras: 6 };
const WITH_SYSTEMS = { motores: [{ id: "a", nombre: "A", familia: "f", sistemas: [SYSTEM] }] };

describe("catalogProblems", () => {
  it("says nothing about a healthy catalog", () => {
    expect(catalogProblems(WITH_SYSTEMS, ES)).toEqual([]);
  });

  it("says nothing while the catalog has not arrived", () => {
    expect(catalogProblems(undefined, ES)).toEqual([]);
  });

  it("explains an empty catalog: where the store is set and how the cases are imported", () => {
    // Arrange
    const empty = { motores: [] };

    // Act
    const problems = catalogProblems(empty, ES);

    // Assert
    expect(problems.map((problem) => problem.id)).toEqual(["catalog.empty"]);
    expect(problems[0]?.severity).toBe("warn");
    expect(problems[0]?.cause).toContain("XPAND_ALMACEN");
    expect(problems[0]?.cause).toContain("importar-casos");
  });

  it("an engine without systems counts as empty", () => {
    const problems = catalogProblems({ motores: [{ id: "a", nombre: "A", familia: "f", sistemas: [] }] }, ES);

    expect(problems.map((problem) => problem.id)).toEqual(["catalog.empty"]);
  });

  it("shows the server's notice as a warning, in the interface's language", () => {
    const catalog = { ...WITH_SYSTEMS, aviso: "Algunos casos no se pudieron cargar." };

    const problems = catalogProblems(catalog, EN);

    expect(problems.map((problem) => problem.id)).toEqual(["catalog.notice"]);
    expect(problems[0]?.severity).toBe("warn");
    expect(problems[0]?.title).toBe("Notice from the case store");
    expect(problems[0]?.cause).toBe("Some cases could not be loaded.");
    expect(catalogProblems(catalog, ES)[0]?.cause).toBe("Algunos casos no se pudieron cargar.");
  });

  it("ignores a notice that is not text", () => {
    expect(catalogProblems({ ...WITH_SYSTEMS, aviso: 3 }, ES)).toEqual([]);
    expect(catalogProblems({ ...WITH_SYSTEMS, aviso: "" }, ES)).toEqual([]);
  });

  it("reports both an empty catalog and its notice", () => {
    const problems = catalogProblems({ motores: [], aviso: "El almacén de casos no existe o está vacío." }, ES);

    expect(problems.map((problem) => problem.id)).toEqual(["catalog.empty", "catalog.notice"]);
  });
});
