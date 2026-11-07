import { ApiFailure } from "@xpand/api";
import { describe, expect, it } from "vitest";
import { isCaseNotFound } from "./caseErrors";

describe("isCaseNotFound", () => {
  it("is true for the server's «caso_no_encontrado»", () => {
    const error = new ApiFailure({ kind: "http", status: 404, route: "/api/red", message: "x", code: "caso_no_encontrado" });

    expect(isCaseNotFound(error)).toBe(true);
  });

  it("is false for any other failure and for what is not an ApiFailure", () => {
    const other = new ApiFailure({ kind: "http", status: 500, route: "/api/red", message: "x", code: "lector_fallo" });
    const noCode = new ApiFailure({ kind: "http", status: 404, route: "/api/red", message: "x" });

    expect(isCaseNotFound(other)).toBe(false);
    expect(isCaseNotFound(noCode)).toBe(false);
    expect(isCaseNotFound(new Error("x"))).toBe(false);
    expect(isCaseNotFound(null)).toBe(false);
  });
});
