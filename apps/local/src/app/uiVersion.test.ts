import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { UI_VERSION } from "./uiVersion";

describe("interface version", () => {
  it("is the version declared in package.json", () => {
    expect(UI_VERSION).toBe(pkg.version);
  });
});
