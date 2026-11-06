import { describe, expect, it } from "vitest";
import { UI_PACKAGE_NAME } from "./index";

describe("@xpand/ui", () => {
  it("exposes its package name", () => {
    expect(UI_PACKAGE_NAME).toBe("@xpand/ui");
  });
});
