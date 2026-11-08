import { describe, expect, it } from "vitest";
import { redReal } from "./red-real";

describe("red_real: the network of a red.json", () => {
  it("a bus without a name, or named «sin nombre», is labelled SE-<id>", () => {
    const red = redReal(
      JSON.stringify({
        barras: [
          { id: 2, nombre: "Sin nombre" },
          { id: 3, nombre: "" },
          { id: 4, nombre: "Norte" },
        ],
      }),
    );
    const barras = red.barras as { id: number; etiqueta: string }[];
    expect(barras.map((b) => b.etiqueta)).toStrictEqual(["SE-2", "SE-3", "Norte"]);
  });

  it("the reference bus is the bus of the largest generation (the first one on a tie)", () => {
    const red = redReal(
      JSON.stringify({
        barras: [{ id: 1 }, { id: 2 }],
        generacion: [
          { bus: 1, mw: 50 },
          { bus: 2, mw: 90 },
        ],
      }),
    );
    expect(red.refbus).toBe(2);
    expect((red.barras as { tipo: number }[]).map((b) => b.tipo)).toStrictEqual([2, 2]);
  });

  it("a corridor is named L<position>_<kV>, with the kV rounded half to even as in Julia", () => {
    const red = redReal(JSON.stringify({ lineas: [{ de: 1, a: 2, kv: 230.5 }, { de: 2, a: 3, kv: 69 }] }));
    expect((red.ac_existentes as { id: string }[]).map((l) => l.id)).toStrictEqual(["L1_230", "L2_69"]);
  });

  it("a candidate without an id takes C<position>_<kV>, and the bank list keeps its fields", () => {
    const red = redReal(
      JSON.stringify({
        candidatos_ac: [{ de: 1, a: 2, kv: 230 }],
        candidatos_bc: [{ bus: 2, qmod: 25 }],
      }),
    );
    expect((red.ac_candidatos as { id: string }[])[0]!.id).toBe("C1_230");
    expect(red.bancos).toMatchObject([{ id: "bc1", bus: 2, qmod: 25, hmax: 0, cmod: 0 }]);
  });
});
