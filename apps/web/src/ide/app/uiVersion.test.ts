import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";
import { createTranslator } from "../i18n/messages";
import { UI_VERSION, versionMessage } from "./uiVersion";

const ES = createTranslator("es");

describe("interface version", () => {
  it("is the version declared in package.json", () => {
    expect(UI_VERSION).toBe(pkg.version);
  });
});

describe("versionMessage", () => {
  it("names the platform and the interface apart when their versions differ", () => {
    expect(versionMessage("0.1.0", "0.2.0", ES)).toBe("Plataforma 0.1.0 · Interfaz 0.2.0");
  });

  it("shows a single version when the platform and the interface share it", () => {
    expect(versionMessage("0.1.0", "0.1.0", ES)).toBe("Versión 0.1.0");
  });
});
