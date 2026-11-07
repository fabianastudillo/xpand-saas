import type { ApiError } from "@xpand/api";
import { describe, expect, it, vi } from "vitest";
import { apiProblems } from "./apiProblems";

const RETRY = vi.fn();

describe("apiProblems", () => {
  it("reports a missing session once, with a link to the classic interface", () => {
    // Arrange
    const errors: ApiError[] = [
      { kind: "auth", status: 401, route: "/api/catalogo", message: "x" },
      { kind: "auth", status: 401, route: "/api/sesion", message: "x" },
    ];

    // Act
    const problems = apiProblems(errors, RETRY);

    // Assert
    expect(problems.map((problem) => problem.id)).toEqual(["api.auth"]);
    expect(problems[0]?.severity).toBe("error");
    expect(problems[0]?.action).toEqual({ label: "Abrir la interfaz clásica", href: "/" });
  });

  it("reports an unreachable server once, with a retry action", () => {
    const errors: ApiError[] = [
      { kind: "network", route: "/api/catalogo", message: "x" },
      { kind: "network", route: "/api/config", message: "x" },
    ];

    const problems = apiProblems(errors, RETRY);

    expect(problems.map((problem) => problem.id)).toEqual(["api.network"]);
    expect(problems[0]?.title).toBe("Sin conexión con el servidor");
    expect(problems[0]?.action).toMatchObject({ label: "Reintentar" });
  });

  it("names the route in HTTP and schema errors, each with its own entry", () => {
    const problems = apiProblems(
      [
        { kind: "http", status: 500, route: "/api/catalogo", message: "x" },
        { kind: "schema", route: "/api/red", message: "data must have required property 'barras'" },
      ],
      RETRY,
    );

    expect(problems.map((problem) => problem.id)).toEqual(["api.http:/api/catalogo", "api.schema:/api/red"]);
    expect(problems[0]?.cause).toContain("/api/catalogo");
    expect(problems[0]?.cause).toContain("500");
    expect(problems[1]?.cause).toContain("barras");
  });

  it("returns nothing when every request succeeded", () => {
    expect(apiProblems([], RETRY)).toEqual([]);
  });
});
