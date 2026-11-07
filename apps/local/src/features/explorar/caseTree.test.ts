import type { Red } from "@xpand/api";
import { describe, expect, it } from "vitest";
import { busLabel, caseTreeGroups, selectedElement, formatSelection, parseSelection, type TreeLabels } from "./caseTree";

const ETIQUETAS: TreeLabels = {
  bus: (nombre) => `Barra ${nombre}`,
  buses: "Barras",
  lines: "Líneas existentes",
  candidates: "Corredores candidatos",
};

const RED: Red = {
  barras: [
    { id: "1", etiqueta: "1", nombre: "1", kv: 0, pd: 80, qd: 24, vmin: 0.95, vmax: 1.05 },
    { id: "2", etiqueta: "2", nombre: "2", kv: 0, pd: 240, qd: 72, vmin: 0.95, vmax: 1.05 },
  ],
  ac_existentes: [{ id: "E12", de: "1", a: "2", r: 0.04, x: 0.4, s: 120 }],
  ac_candidatos: [{ id: "C12", de: "1", a: "2", r: 0.04, x: 0.4, s: 120, costo: 516.1, nmax: 3 }],
};

describe("arbolDelCaso", () => {
  it("builds the three groups with their counts and labelled items", () => {
    const groups = caseTreeGroups(RED, ETIQUETAS);

    expect(groups.map((group) => [group.id, group.label, group.count])).toEqual([
      ["buses", "Barras", 2],
      ["lines", "Líneas existentes", 1],
      ["candidates", "Corredores candidatos", 1],
    ]);
    expect(groups[0]?.items.map((item) => [item.id, item.label])).toEqual([
      ["1", "Barra 1"],
      ["2", "Barra 2"],
    ]);
    expect(groups[1]?.items[0]).toMatchObject({ id: "E12", label: "1 – 2" });
  });
});

describe("busLabel", () => {
  const base = { kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05 };

  it("prefers the operator's name, then the label, then the id", () => {
    expect(busLabel({ ...base, id: "12", etiqueta: "SE-12", nombre: "Molino" })).toBe("Molino");
    expect(busLabel({ ...base, id: "12", etiqueta: "SE-12" })).toBe("SE-12");
    expect(busLabel({ ...base, id: "12", etiqueta: "" })).toBe("12");
  });

  it("treats an empty name as absent, so the label is not lost", () => {
    expect(busLabel({ ...base, id: "3", etiqueta: "Chorrillos", nombre: "" })).toBe("Chorrillos");
  });

  it("labels the tree items of buses without «nombre» by their etiqueta", () => {
    const red: Red = {
      ...RED,
      barras: [{ id: "9", etiqueta: "Subestación Nueve", kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05 }],
    };
    expect(caseTreeGroups(red, ETIQUETAS)[0]?.items[0]).toEqual({ id: "9", label: "Barra Subestación Nueve" });
  });
});

describe("elementoSeleccionado", () => {
  it("finds the bus, line or candidate that a selection names", () => {
    expect(selectedElement(RED, { group: "buses", id: "2" })).toEqual({
      kind: "bus",
      bus: RED.barras[1],
    });
    expect(selectedElement(RED, { group: "lines", id: "E12" })?.kind).toBe("line");
    expect(selectedElement(RED, { group: "candidates", id: "C12" })?.kind).toBe("candidate");
  });

  it("returns null for a selection that the case does not have", () => {
    expect(selectedElement(RED, { group: "buses", id: "99" })).toBeNull();
    expect(selectedElement(RED, null)).toBeNull();
  });
});

describe("parseSeleccion and formatSeleccion", () => {
  it("round-trips a selection whose id contains a colon", () => {
    const selection = { group: "buses", id: "a:b" };
    expect(parseSelection(formatSelection(selection))).toEqual(selection);
  });

  it("returns null for a missing or malformed value", () => {
    expect(parseSelection(null)).toBeNull();
    expect(parseSelection("buses")).toBeNull();
  });
});
