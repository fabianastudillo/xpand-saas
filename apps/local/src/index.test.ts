import { describe, expect, it } from "vitest";
import { LOCAL_APP_NAME } from "./index";

describe("@xpand/local", () => {
  it("exposes its package name", () => {
    expect(LOCAL_APP_NAME).toBe("@xpand/local");
  });
});
