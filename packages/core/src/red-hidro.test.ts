import { describe, expect, it } from "vitest";
import { redHidro } from "./red-hidro";
import type { Leer } from "./red-base";

// The files of a case: etapas/etapas.csv and the two centrales beside the etapas directory.
const caso = (archivos: Record<string, string>): Leer => (ruta) => archivos[ruta.replace("/caso/", "")];
const ETAPAS = "/caso/etapas/etapas.csv";

describe("red_hidro: one isolated bus with the peak demand of stage 1", () => {
  it("the peak demand is the GWh of stage 1 in MW, over its hours", () => {
    const red = redHidro(
      ETAPAS,
      caso({
        "etapas/etapas.csv": "etapa,demanda_GWh,horas\n1,8760,8760\n2,9000,8760\n",
      }),
    );
    const barra = (red.barras as { id: string; pd: number; gen: unknown[] }[])[0]!;
    expect(barra).toMatchObject({ id: "1", pd: 1000, gen: [] });
  });

  it("the generators are the hydro and thermal plants, with their identifiers", () => {
    const red = redHidro(
      ETAPAS,
      caso({
        "etapas/etapas.csv": "etapa,demanda_GWh,horas\n1,8760,8760\n",
        "centrales_hidro.csv": "nombre,potencia_MW\nHID_A,120\n",
        "centrales_termicas.csv": "nombre,potencia_instalada_MW,costo_variable_calc_USD_MWh\nTER_A,50,31.2\n",
      }),
    );
    const barra = (red.barras as { gen: { id: string; tec: string; pmax: number }[]; pgmax: number }[])[0]!;
    expect(barra.gen.map((g) => [g.id, g.tec, g.pmax])).toStrictEqual([
      ["H_HID_A", "hidro", 120],
      ["T_TER_A", "termica", 50],
    ]);
    expect(barra.pgmax).toBe(170);
  });

  // Frozen reference behaviour (defect D3.2, not corrected here): the headers and the stage are not trimmed.
  it("[frozen, D3.2] without a row of stage \"1\", the reference fails with an error", () => {
    expect(() => redHidro(ETAPAS, caso({ "etapas/etapas.csv": "etapa,demanda_GWh,horas\n2,9000,8760\n" }))).toThrow(
      /empty collection/,
    );
  });

  it("[frozen, D3.2] a header with a space is a missing column, and the reference fails", () => {
    expect(() =>
      redHidro(ETAPAS, caso({ "etapas/etapas.csv": "etapa, demanda_GWh, horas\n1, 10, 100\n" })),
    ).toThrow(/KeyError/);
  });
});
