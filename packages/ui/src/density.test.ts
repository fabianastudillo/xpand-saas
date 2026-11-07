import { describe, expect, it } from "vitest";
import { applyDensity, DENSITY_ATTRIBUTE } from "./density";

describe("applyDensity", () => {
  it("sets the attribute for compact and removes it for normal", () => {
    const element = document.createElement("div");
    applyDensity(element, "compact");
    expect(element.getAttribute(DENSITY_ATTRIBUTE)).toBe("compact");
    applyDensity(element, "normal");
    expect(element.hasAttribute(DENSITY_ATTRIBUTE)).toBe(false);
  });
});
