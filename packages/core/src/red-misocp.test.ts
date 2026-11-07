import { describe, expect, it } from "vitest";
import { redMisocp } from "./red-misocp";

// A virtual case: the files of one directory, read through the Leer callback of the reader.
// The paths are under /caso, so the base path ends in /base.dat as in the reference.
function caso(archivos: Record<string, string>) {
  return (ruta: string) => archivos[ruta.replace("/caso/", "")];
}

const BASE = [
  "param Sbase := 100;",
  "param : BUS : bus_type Pd Qd Vmin Vmax kV :=",
  "1 3 0 0 0.95 1.05 138",
  "2 1 0.6 0.2 0.95 1.05 138",
  ";",
  "set GEN := g1;",
  "param gen_bus :=",
  "g1 1",
  ";",
  "param Pgmax :=",
  "g1 1.5",
  ";",
  "param cg1 :=",
  "g1 20",
  ";",
].join("\n");

const TECNOLOGIA = [
  "set GEN := g1 gfv;",
  "param gen_bus :=",
  "gfv 2",
  ";",
  "param Pgmax :=",
  "g1 1.2",
  "gfv 0.5",
  ";",
].join("\n");

describe("red_misocp: merge of the base and the technologies", () => {
  it("a later technology overwrites the base value and joins the sets", () => {
    const red = redMisocp(["/caso/base.dat", "/caso/tec_solar.dat"], caso({ "base.dat": BASE, "tec_solar.dat": TECNOLOGIA }));
    const barras = red.barras as { id: string; gen: { id: string; pmax: number }[] }[];
    const gens = barras.flatMap((b) => b.gen);
    // g1 keeps its bus but takes the technology's Pgmax (1.2 pu on Sbase 100).
    expect(gens.find((g) => g.id === "g1")?.pmax).toBe(120);
    expect(gens.map((g) => g.id).sort()).toStrictEqual(["g1", "gfv"]);
  });

  it("a technology whose file is missing gives empty sets, without error", () => {
    const con = redMisocp(["/caso/base.dat", "/caso/tec_ausente.dat"], caso({ "base.dat": BASE }));
    const sin = redMisocp(["/caso/base.dat"], caso({ "base.dat": BASE }));
    expect(con).toStrictEqual(sin);
  });

  it("an empty list of files gives an empty network of the same shape", () => {
    const red = redMisocp([], caso({}));
    expect(red.esquema).toBe("misocp");
    expect(red.barras).toStrictEqual([]);
    expect(red.ac_existentes).toStrictEqual([]);
    expect(red.ibr_tpwrs).toStrictEqual({});
    expect(red.sitios).toStrictEqual([]);
  });

  it("a base file that does not exist gives an empty network, without error", () => {
    const red = redMisocp(["/caso/base.dat"], caso({}));
    expect(red.barras).toStrictEqual([]);
    expect(red.sbase).toBe(100);
  });

  it("dinamica.dat and econ.dat beside the base feed the generators and the scalars", () => {
    const dinamica = "param gen_h :=\ng1 4.5\n;";
    const econ = "param irate := 0.1;";
    const red = redMisocp(
      ["/caso/base.dat"],
      caso({ "base.dat": BASE, "dinamica.dat": dinamica, "econ.dat": econ }),
    );
    const barras = red.barras as { gen: { h?: number }[] }[];
    expect(barras[0]?.gen[0]?.h).toBe(4.5);
    expect(red.econ).toStrictEqual({ irate: 0.1 });
  });
});
