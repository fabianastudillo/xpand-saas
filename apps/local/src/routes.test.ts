import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { casePath } from "./lib/casePath";
import { ROUTE_TABLE } from "./routes";

describe("route table", () => {
  it("gives the case parameters back decoded, names with accents and slashes included", () => {
    // Arrange
    const engine = "jump_misocp";
    const system = "SNI año/2032 ñ";

    // Act
    const matches = matchRoutes(ROUTE_TABLE, casePath(engine, system)) ?? [];
    const params = matches.at(-1)?.params;

    // Assert
    expect(params).toEqual({ motor: engine, sistema: system });
  });

  it("opens the catalog at the root of the app", () => {
    const matches = matchRoutes(ROUTE_TABLE, "/") ?? [];
    expect(matches.at(-1)?.route.path).toBe("/");
  });
});
