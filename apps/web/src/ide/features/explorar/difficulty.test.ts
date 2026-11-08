import { describe, expect, it } from "vitest";
import { createTranslator } from "../../i18n/messages";
import { difficultyLabel } from "./difficulty";

describe("difficultyLabel", () => {
  const es = createTranslator("es");
  const en = createTranslator("en");

  it("translates every value of the catalog's enum", () => {
    expect(difficultyLabel("rapido", es)).toBe("rápido");
    expect(difficultyLabel("medio", es)).toBe("medio");
    expect(difficultyLabel("pesado", es)).toBe("pesado");
    expect(difficultyLabel("pesado", en)).toBe("heavy");
  });

  it("shows an unknown value as it arrives, and nothing for an absent one", () => {
    expect(difficultyLabel("extremo", es)).toBe("extremo");
    expect(difficultyLabel("", es)).toBeNull();
    expect(difficultyLabel(undefined, es)).toBeNull();
  });
});
