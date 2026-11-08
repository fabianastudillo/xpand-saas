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

  it("says that some cases could not be loaded when the server's code is «descartados», in the interface's language", () => {
    const catalog = { ...WITH_SYSTEMS, aviso: "Algunos casos no se pudieron cargar.", codigo_aviso: "descartados" };

    const problems = catalogProblems(catalog, EN);

    expect(problems.map((problem) => problem.id)).toEqual(["catalog.notice"]);
    expect(problems[0]?.severity).toBe("warn");
    expect(problems[0]?.title).toBe("Notice from the case store");
    expect(problems[0]?.cause).toBe("Some cases could not be loaded.");
    expect(catalogProblems(catalog, ES)[0]?.cause).toBe("Algunos casos no se pudieron cargar.");
  });

  it("says the store could not be updated (and the last reading is shown) when the code is «relectura»", () => {
    const catalog = { ...WITH_SYSTEMS, aviso: "No se pudo actualizar el almacén de casos.", codigo_aviso: "relectura" };

    expect(catalogProblems(catalog, ES)[0]?.cause).toBe(
      "No se pudo actualizar el almacén de casos; se muestra la última lectura.",
    );
    expect(catalogProblems(catalog, EN)[0]?.cause).toBe("The case store could not be updated; the last reading is shown.");
  });

  it("a notice with no code, or a code it does not know, gets the generic text, never the server's prose", () => {
    for (const codigo of [undefined, "otro_codigo"]) {
      const catalog = { ...WITH_SYSTEMS, aviso: "Texto del servidor.", ...(codigo === undefined ? {} : { codigo_aviso: codigo }) };

      const problems = catalogProblems(catalog, ES);

      expect(problems.map((problem) => problem.id)).toEqual(["catalog.notice"]);
      expect(problems[0]?.cause).toBe("El servidor avisa de un problema con el almacén de casos.");
    }
  });

  // A notice that is not text no longer reaches here: the contract types «aviso» and «codigo_aviso» as strings.
  it("ignores an empty notice", () => {
    expect(catalogProblems({ ...WITH_SYSTEMS, aviso: "" }, ES)).toEqual([]);
  });

  it("an empty catalog says only that it is empty: no second note that would claim cases failed", () => {
    for (const codigo_aviso of ["vacio", "relectura", "descartados"]) {
      const catalog = { motores: [], aviso: "El almacén de casos no existe o está vacío.", codigo_aviso };

      const problems = catalogProblems(catalog, ES);

      expect(problems.map((problem) => problem.id)).toEqual(["catalog.empty"]);
    }
  });
});
