import { describe, expect, it } from "vitest";
import { casePath, parseCasePath, parseStrayCasePath } from "./casePath";

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

describe("parseCasePath", () => {
  it("gives the identifiers back from the address, decoded", () => {
    // Arrange
    const path = casePath("jump_misocp", "SNI año/2032 ñ");

    // Act
    const parsed = parseCasePath(path);

    // Assert
    expect(parsed).toEqual({ engineId: "jump_misocp", systemId: "SNI año/2032 ñ" });
  });

  it("reads plain identifiers", () => {
    expect(parseCasePath("/casos/fp_dc/tnep_garver6")).toEqual({ engineId: "fp_dc", systemId: "tnep_garver6" });
  });

  it("is null for the catalog and for any other address", () => {
    expect(parseCasePath("/casos")).toBeNull();
    expect(parseCasePath("/casos/")).toBeNull();
    expect(parseCasePath("/")).toBeNull();
    expect(parseCasePath("/casos/uno")).toBeNull();
    expect(parseCasePath("/casos/uno/dos/tres")).toBeNull();
    expect(parseCasePath("/otra/uno/dos")).toBeNull();
    expect(parseCasePath(null)).toBeNull();
  });

  it("is null for an address with a broken percent sequence instead of throwing", () => {
    expect(parseCasePath("/casos/uno/%E0%A4%A")).toBeNull();
  });
});

describe("parseStrayCasePath", () => {
  it("gives the one segment of /casos/<segmento>, decoded: an address that is not a case", () => {
    expect(parseStrayCasePath("/casos/tnep_garver6")).toBe("tnep_garver6");
    expect(parseStrayCasePath("/casos/SNI%20a%C3%B1o")).toBe("SNI año");
  });

  it("is null for the catalog, for a case, for more segments and for a broken percent sequence", () => {
    for (const path of [null, "/casos", "/casos/", "/casos/a/b", "/casos/a/b/c", "/otra/a", "/casos/%E0%A4%A"]) {
      expect(parseStrayCasePath(path)).toBeNull();
    }
  });
});
