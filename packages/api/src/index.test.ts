import { describe, expect, it } from "vitest";
import { API_PACKAGE_NAME } from "./index";

describe("@xpand/api", () => {
  it("exposes its package name", () => {
    expect(API_PACKAGE_NAME).toBe("@xpand/api");
  });
});
