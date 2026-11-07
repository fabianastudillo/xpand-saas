import { describe, expect, it } from "vitest";
import { casePath } from "./casePath";

describe("casoPath", () => {
  it("builds the case route from plain identifiers", () => {
    // Arrange
    const engine = "jump_misocp";
    const system = "tnep_garver6";

    // Act
    const path = casePath(engine, system);

    // Assert
    expect(path).toBe("/casos/jump_misocp/tnep_garver6");
  });

  it("encodes accents, spaces and slashes, and parsing gives the identifier back", () => {
    // Arrange
    const engine = "jump_misocp";
    const system = "SNI año/2032 ñ";

    // Act
    const path = casePath(engine, system);
    const decoded = path.split("/").slice(2).map((segment) => decodeURIComponent(segment));

    // Assert
    expect(path).toBe("/casos/jump_misocp/SNI%20a%C3%B1o%2F2032%20%C3%B1");
    expect(decoded).toEqual([engine, system]);
  });
});
