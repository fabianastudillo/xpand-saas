import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";
import { appText, createTranslator } from "./messages";

describe("app messages", () => {
  it("have the same keys in Spanish and English, each with a text", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const [key, text] of Object.entries({ ...es, ...en })) {
      expect(text, key).not.toBe("");
    }
  });

  it("fills the named placeholders from the variables", () => {
    expect(appText("catalog.count", { n: 3 })).toBe("3 sistemas");
    expect(createTranslator("en")("catalog.difficulty", { value: "fast" })).toBe("Effort: fast");
  });

  it("keeps a placeholder visible when no variable names it", () => {
    expect(createTranslator("es")("catalog.difficulty")).toBe("Esfuerzo: {value}");
  });

  it("names the platform and the interface apart in the status bar", () => {
    const vars = { server: "1.0.0", ui: "0.1.0" };
    expect(createTranslator("es")("state.versions", vars)).toBe("Plataforma 1.0.0 · Interfaz 0.1.0");
    expect(createTranslator("en")("state.versions", vars)).toBe("Platform 1.0.0 · UI 0.1.0");
  });

  it("shows one version in the status bar when both are equal", () => {
    expect(createTranslator("es")("state.version", { version: "0.1.0" })).toBe("Versión 0.1.0");
    expect(createTranslator("en")("state.version", { version: "0.1.0" })).toBe("Version 0.1.0");
  });

  it("gives a different translator for each locale", () => {
    expect(createTranslator("es")("catalog.title")).not.toBe(createTranslator("en")("catalog.title"));
  });
});
