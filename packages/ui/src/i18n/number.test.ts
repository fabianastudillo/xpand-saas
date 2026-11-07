import { describe, expect, it } from "vitest";
import { formatNumber } from "./number";

describe("formatNumber", () => {
  it("uses the comma in Spanish and the point in English, without grouping", () => {
    expect(formatNumber(1457.8, { digits: 1, locale: "es" })).toBe("1457,8");
    expect(formatNumber(1457.8, { digits: 1, locale: "en" })).toBe("1457.8");
    expect(formatNumber(14578.25, { digits: 2, locale: "es" })).toBe("14578,25");
  });

  it("pads and rounds to the requested digits", () => {
    expect(formatNumber(110, { digits: 1, locale: "es" })).toBe("110,0");
    expect(formatNumber(884.926, { digits: 2, locale: "en" })).toBe("884.93");
    expect(formatNumber(6, { digits: 0, locale: "en" })).toBe("6");
  });

  it("returns an em dash for values that are not finite", () => {
    expect(formatNumber(Number.NaN, { digits: 1, locale: "es" })).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY, { digits: 1, locale: "en" })).toBe("—");
  });

  it("keeps the minus sign readable", () => {
    expect(formatNumber(-12.5, { digits: 1, locale: "en" })).toBe("-12.5");
  });
});
