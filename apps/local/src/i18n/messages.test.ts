import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";
import { appText } from "./messages";

describe("app messages", () => {
  it("have the same keys in Spanish and English, each with a text", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const [key, text] of Object.entries({ ...es, ...en })) {
      expect(text, key).not.toBe("");
    }
  });

  it("interpolates named placeholders and keeps unknown ones visible", () => {
    expect(appText("catalog.count", { n: 3 })).toBe("3 sistemas");
    expect(appText("catalog.count.one")).toBe("1 sistema");
  });
});
