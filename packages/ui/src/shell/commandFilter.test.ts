import { describe, expect, it } from "vitest";
import { filterCommands, groupCommands, normalizeText, type Command } from "./commandFilter";

const noop = (): void => {};
const commands: readonly Command[] = [
  { id: "open-garver", label: "Abrir Garver 6", group: "Casos", run: noop },
  { id: "reduce", label: "Reducción a transmisión", group: "Red", run: noop },
  { id: "solve", label: "Resolver", group: "Ejecutar", shortcut: "Ctrl+Enter", run: noop },
  { id: "n1", label: "Contingencias N-1", group: "Análisis", run: noop },
];

describe("normalizeText", () => {
  it("drops accents and case so «reduccion» equals «Reducción»", () => {
    expect(normalizeText("Reducción")).toBe("reduccion");
    expect(normalizeText("  Análisis N-1 ")).toBe("analisis n-1");
    expect(normalizeText("Ñandú")).toBe("nandu");
  });
});

describe("filterCommands", () => {
  it("returns everything for an empty query", () => {
    expect(filterCommands(commands, "   ")).toHaveLength(4);
  });

  it("matches the label without accents and ignoring case", () => {
    expect(filterCommands(commands, "reduccion").map((command) => command.id)).toEqual(["reduce"]);
    expect(filterCommands(commands, "GARVER").map((command) => command.id)).toEqual(["open-garver"]);
  });

  it("also matches the group name", () => {
    expect(filterCommands(commands, "analisis").map((command) => command.id)).toEqual(["n1"]);
  });

  it("matches every word of the query in any order", () => {
    expect(filterCommands(commands, "6 abrir").map((command) => command.id)).toEqual(["open-garver"]);
    expect(filterCommands(commands, "abrir resolver")).toHaveLength(0);
  });
});

describe("groupCommands", () => {
  it("keeps the first-seen order of groups and of commands inside them", () => {
    const grouped = groupCommands([...commands, { id: "open-ieee", label: "Abrir IEEE 24", group: "Casos", run: noop }]);
    expect(grouped.map((group) => group.group)).toEqual(["Casos", "Red", "Ejecutar", "Análisis"]);
    expect(grouped[0]?.commands.map((command) => command.id)).toEqual(["open-garver", "open-ieee"]);
  });
});
