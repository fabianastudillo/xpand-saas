import type { ApiError } from "@xpand/api";
import { describe, expect, it, vi } from "vitest";
import { apiProblems } from "./apiProblems";
import { createTranslator } from "../i18n/messages";

const ES = createTranslator("es");

const RETRY = vi.fn();

describe("apiProblems", () => {
  it("reports a missing session once, with a retry as its only action", () => {
    // Arrange
    const errors: ApiError[] = [
      { kind: "auth", status: 401, route: "/api/catalogo", message: "x" },
      { kind: "auth", status: 401, route: "/api/sesion", message: "x" },
    ];

    // Act
    const problems = apiProblems(errors, RETRY, ES);

    // Assert
    expect(problems.map((problem) => problem.id)).toEqual(["api.auth"]);
    expect(problems[0]?.severity).toBe("error");
    expect(problems[0]?.action).toEqual({ label: "Reintentar", run: RETRY });
    expect(problems[0]?.secondaryAction).toBeUndefined();
  });

  it("reports an unreachable server once, with a retry action", () => {
    const errors: ApiError[] = [
      { kind: "network", route: "/api/catalogo", message: "x" },
      { kind: "network", route: "/api/config", message: "x" },
    ];

    const problems = apiProblems(errors, RETRY, ES);

    expect(problems.map((problem) => problem.id)).toEqual(["api.network"]);
    expect(problems[0]?.title).toBe("Sin conexión con el servidor");
    expect(problems[0]?.action).toMatchObject({ label: "Reintentar" });
  });

  it("reports an HTTP error once, naming the first failing route and its status", () => {
    const problems = apiProblems(
      [
        { kind: "http", status: 500, route: "/api/catalogo", message: "x" },
        { kind: "http", status: 500, route: "/api/sesion", message: "x" },
      ],
      RETRY,
      ES,
    );

    expect(problems.map((problem) => problem.id)).toEqual(["api.http"]);
    expect(problems[0]?.cause).toContain("/api/catalogo");
    expect(problems[0]?.cause).toContain("500");
    expect(problems[0]?.action).toMatchObject({ label: "Reintentar" });
  });

  it("names the route of a schema error, one entry per route", () => {
    const problems = apiProblems(
      [
        { kind: "schema", route: "/api/red", message: "data must have required property 'barras'" },
        { kind: "schema", route: "/api/catalogo", message: "x" },
      ],
      RETRY,
      ES,
    );

    expect(problems.map((problem) => problem.id)).toEqual(["api.schema:/api/red", "api.schema:/api/catalogo"]);
    expect(problems[0]?.cause).toContain("barras");
  });

  it("a case that does not exist is not retried: it says so and offers the catalog", () => {
    // Arrange
    const error: ApiError = { kind: "http", status: 404, route: "/api/red", message: "x", code: "caso_no_encontrado" };

    // Act
    const problems = apiProblems([error], RETRY, ES);

    // Assert
    expect(problems.map((problem) => problem.id)).toEqual(["api.notFound"]);
    expect(problems[0]?.title).toBe("Caso no encontrado");
    expect(problems[0]?.action).toEqual({ label: "Ir al catálogo", href: "/casos" });
  });

  it("an unavailable store (503) names XPAND_ALMACEN as the cause and keeps the retry", () => {
    const error: ApiError = { kind: "http", status: 503, route: "/api/catalogo", message: "x", code: "almacen_no_disponible" };

    const problems = apiProblems([error, { ...error, route: "/api/red" }], RETRY, ES);

    expect(problems.map((problem) => problem.id)).toEqual(["api.store"]);
    expect(problems[0]?.cause).toContain("XPAND_ALMACEN");
    expect(problems[0]?.cause).toContain("importar-casos");
    expect(problems[0]?.action).toMatchObject({ label: "Reintentar" });
  });

  it("a case the reader cannot read (500) says the rest of the catalog still works", () => {
    const error: ApiError = { kind: "http", status: 500, route: "/api/red", message: "x", code: "lector_fallo" };

    const problems = apiProblems([error], RETRY, ES);

    expect(problems.map((problem) => problem.id)).toEqual(["api.reader"]);
    expect(problems[0]?.title).toBe("No se pudo leer el caso");
    expect(problems[0]?.cause).toContain("resto del catálogo");
  });

  it("speaks English with the same entries", () => {
    const error: ApiError = { kind: "http", status: 404, route: "/api/red", message: "x", code: "caso_no_encontrado" };

    const problems = apiProblems([error], RETRY, createTranslator("en"));

    expect(problems[0]?.title).toBe("Case not found");
    expect(problems[0]?.action).toEqual({ label: "Go to the catalog", href: "/casos" });
  });

  it("returns nothing when every request succeeded", () => {
    expect(apiProblems([], RETRY, ES)).toEqual([]);
  });
});
