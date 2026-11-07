import type { ApiError } from "@xpand/api";
import { describe, expect, it, vi } from "vitest";
import { apiProblems } from "./apiProblems";
import { createTranslator } from "../i18n/messages";

const ES = createTranslator("es");

const RETRY = vi.fn();

describe("apiProblems", () => {
  it("reports a missing session once, with a link to the classic interface", () => {
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
    expect(problems[0]?.action).toEqual({ label: "Abrir la interfaz clásica", href: "/" });
  });

  it("also offers to retry a missing session: after signing in elsewhere, no reload is needed", () => {
    const problems = apiProblems([{ kind: "auth", status: 401, route: "/api/catalogo", message: "x" }], RETRY, ES);

    expect(problems[0]?.secondaryAction).toMatchObject({ label: "Reintentar", run: RETRY });
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

  it("returns nothing when every request succeeded", () => {
    expect(apiProblems([], RETRY, ES)).toEqual([]);
  });
});
