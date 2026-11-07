import { describe, expect, it } from "vitest";
import { redGfmgfl } from "./red-gfmgfl";

// One virtual file of the case, read through the Leer callback.
const caso = (texto: string) => (ruta: string) => (ruta === "/caso/caso.dat" ? texto : undefined);
const RUTAS = ["/caso/caso.dat"];

describe("red_gfmgfl: buses, branches, sites and synchronous generators", () => {
  it("a bus of type 0 becomes a slack bus (type 3), and PD0 overrides PD", () => {
    const red = redGfmgfl(
      RUTAS,
      caso(
        [
          "param : BUS : TP PD PD0 QD QD0 PGM :=",
          "1 0 5 7 1 2 0",
          "2 1 4 0 1 0 0",
          ";",
        ].join("\n"),
      ),
    );
    const [b1, b2] = red.barras as { id: string; tipo: number; pd: number; qd: number }[];
    expect(b1).toMatchObject({ id: "1", tipo: 3, pd: 7, qd: 2 });
    expect(b2).toMatchObject({ id: "2", tipo: 1, pd: 0, qd: 0 });
  });

  it("a bus is synchronous when it is a SGEN or carries PGM, and an IBR site when it is in CBUS", () => {
    const red = redGfmgfl(
      RUTAS,
      caso(
        [
          "set CBUS := 2;",
          "set SGEN := 1;",
          "param : BUS : TP PD QD PGM :=",
          "1 1 0 0 0",
          "2 1 0 0 0",
          "3 1 0 0 0.5",
          ";",
        ].join("\n"),
      ),
    );
    const barras = red.barras as { id: string; sincrona: boolean; sitio_ibr: boolean }[];
    expect(barras.map((b) => [b.id, b.sincrona, b.sitio_ibr])).toStrictEqual([
      ["1", true, false],
      ["2", false, true],
      ["3", true, false],
    ]);
  });

  it("a branch indexed by (k,i,j) keeps the existing part in ac_existentes and the candidate part in ac_candidatos", () => {
    const red = redGfmgfl(
      RUTAS,
      caso(
        [
          "param : BRANCH : r x bsh SMAX N0 NMAX BCOST :=",
          "7 1 2 0.01 0.1 0.02 2 1 0 0",
          "8 2 3 0.02 0.2 0.03 1 0 2 0.5",
          ";",
        ].join("\n"),
      ),
    );
    const existentes = red.ac_existentes as { id: string; de: string; a: string; n: number }[];
    const candidatas = red.ac_candidatos as { id: string; de: string; nmax: number }[];
    expect(existentes).toMatchObject([{ id: "L7", de: "1", a: "2", n: 1 }]);
    // Branch 7 has NMAX 0, so it is not a candidate; branch 8 has NMAX 2 and no existing part.
    expect(candidatas.map((c) => [c.id, c.de, c.nmax])).toStrictEqual([["L8", "2", 2]]);
  });

  it("a set element of a length other than 3 is skipped, as in the reference", () => {
    const red = redGfmgfl(RUTAS, caso("set BRANCH := (1,2) (4,5);"));
    expect(red.ac_existentes).toStrictEqual([]);
    expect(red.ac_candidatos).toStrictEqual([]);
  });

  it("the contingencies are the joined elements of CTG", () => {
    const red = redGfmgfl(RUTAS, caso("set CTG := c1 c2;"));
    expect(red.contingencias).toStrictEqual(["c1", "c2"]);
  });
});
