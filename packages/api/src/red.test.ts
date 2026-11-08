import { describe, expect, it } from "vitest";
import type { Red as RedWire } from "./generated/red";
import { normalizeRed } from "./red";

/** The shape of the «real» engine (red_real in xpand): integer bus ids and line ends, no «nombre». */
const RED_ENTEROS: RedWire = {
  barras: [
    { id: 1, etiqueta: "Subestación A", kv: 230, pd: 10, qd: 2, vmin: 0.95, vmax: 1.05 },
    { id: 2, etiqueta: "", kv: 230, pd: 20, qd: 4, vmin: 0.95, vmax: 1.05 },
  ],
  ac_existentes: [{ id: "L1_230", de: 1, a: 2, r: 0.01, x: 0.1, s: 300 }],
  ac_candidatos: [{ id: "C1_230", de: 2, a: 1, r: 0.01, x: 0.1, s: 300, costo: 12.5, nmax: 2 }],
  esquema: "real",
};

describe("normalizeRed", () => {
  it("turns integer bus ids and line ends into strings, and keeps everything else", () => {
    // Act
    const red = normalizeRed(RED_ENTEROS);

    // Assert
    expect(red.barras.map((bus) => bus.id)).toEqual(["1", "2"]);
    expect(red.ac_existentes[0]).toMatchObject({ id: "L1_230", de: "1", a: "2", r: 0.01 });
    expect(red.ac_candidatos[0]).toMatchObject({ de: "2", a: "1", costo: 12.5, nmax: 2 });
    expect(red["esquema"]).toBe("real");
  });

  it("keeps a bus without «nombre» without one, and an empty «etiqueta» as it came", () => {
    const red = normalizeRed(RED_ENTEROS);

    expect("nombre" in (red.barras[0] ?? {})).toBe(false);
    expect(red.barras[1]?.etiqueta).toBe("");
  });

  it("leaves string ids untouched and does not mutate the input", () => {
    const wire: RedWire = {
      barras: [{ id: "7", etiqueta: "7", nombre: "Siete", kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05 }],
      ac_existentes: [{ id: "E", de: "7", a: "7", r: 0, x: 0, s: 0 }],
      ac_candidatos: [],
    };
    const copia = structuredClone(wire);

    const red = normalizeRed(wire);

    expect(red.barras[0]).toEqual({ id: "7", etiqueta: "7", nombre: "Siete", kv: 0, pd: 0, qd: 0, vmin: 0.95, vmax: 1.05 });
    expect(red.ac_existentes[0]).toMatchObject({ de: "7", a: "7" });
    expect(wire).toEqual(copia);
  });
});
