import { describe, expect, it } from "vitest";
import { redMatpower } from "./red-matpower";

// A small MATPOWER case with the GTNEP tables; the rows are written by the caller.
function caso(tablas: string): string {
  return [
    "function mpc = caso",
    "mpc.baseMVA = 100;",
    "mpc.bus = [",
    "\t1\t3\t0\t0\t0\t0\t1\t1.0\t0\t138\t1\t1.06\t0.94;",
    "\t2\t1\t10\t5\t0\t0\t1\t1.0\t0\t138\t1\t1.06\t0.94;",
    "];",
    "mpc.gen = [",
    "\t1\t50\t0\t30\t-30\t1.0\t100\t1\t150\t0;",
    "\t2\t20\t0\t10\t-10\t1.0\t100\t0\t80\t0;",
    "];",
    "mpc.branch = [",
    "\t1\t2\t0.01\t0.1\t0.02\t100\t100\t100\t0\t0\t1\t-360\t360;",
    "];",
    tablas,
  ].join("\n");
}

describe("red_matpower: the base network", () => {
  it("takes the reference bus from the type-3 bus, and leaves out a generator out of service", () => {
    const red = redMatpower(caso(""));
    expect(red.refbus).toBe("1");
    const barras = red.barras as { id: string; pgmax: number; gen: { id: string }[] }[];
    // Generator 2 is out of service (status 0): only generator 1 is in the network.
    expect(barras.find((b) => b.id === "1")?.gen.map((g) => g.id)).toStrictEqual(["G1_1"]);
    expect(barras.find((b) => b.id === "1")?.pgmax).toBe(150);
    expect(barras.find((b) => b.id === "2")?.gen).toStrictEqual([]);
  });

  it("a line with ratio 0 is an identity ratio (tap 1), not a division by zero", () => {
    const red = redMatpower(caso(""));
    expect(red.ac_existentes).toMatchObject([{ id: "E1", de: "1", a: "2", tap: 1 }]);
  });
});

describe("red_matpower: candidate branches (ne_branch)", () => {
  it("folds the copies of a corridor (copia k/n) into one candidate with nmax n", () => {
    const red = redMatpower(
      caso(
        [
          "mpc.ne_branch = [",
          "\t1\t2\t0.02\t0.2\t0.02\t100\t100\t100\t1\t0\t1\t-360\t360\t1.5\t2\t0;\t% L12 copia 1/2",
          "\t1\t2\t0.02\t0.2\t0.02\t100\t100\t100\t1\t0\t1\t-360\t360\t1.5\t2\t0;\t% L12 copia 2/2",
          "];",
        ].join("\n"),
      ),
    );
    expect(red.ac_candidatos).toMatchObject([{ id: "L12", de: "1", a: "2", nmax: 2 }]);
  });

  it("without a comment the candidate takes its id from its position and nmax from column 15", () => {
    const red = redMatpower(
      caso(["mpc.ne_branch = [", "\t1\t2\t0.02\t0.2\t0.02\t100\t100\t100\t1\t0\t1\t-360\t360\t1.5\t3\t0;", "];"].join("\n")),
    );
    expect(red.ac_candidatos).toMatchObject([{ id: "C1", nmax: 3 }]);
  });
});

describe("red_matpower: HVDC, converters and candidate generators", () => {
  it("a DC node written as a quoted text is kept as text, and an extra DC node is listed as candidate", () => {
    const red = redMatpower(
      caso(["mpc.busdc = [", "\t'DC_A'\t1\t0\t1.0\t345\t1.1\t0.9\t0;", "];"].join("\n")),
    );
    expect(red.nodos_dc).toMatchObject([{ id: "DC_A", existente: true, kv: 345 }]);
  });

  it("a converter's rated power is the larger of |Pacmax| and |Pacmin|", () => {
    const fila = Array.from({ length: 35 }, (_, k) => (k === 30 ? "40" : k === 31 ? "-60" : "0"));
    const red = redMatpower(caso(["mpc.convdc_ne = [", `\t${fila.join("\t")};`, "];"].join("\n")));
    expect(red.convertidores).toMatchObject([{ srated: 60, existente: false, pacmax: 40, pacmin: -60 }]);
  });

  it("candidate_gen gives the candidate's nominal power (column 9) and no technology", () => {
    const red = redMatpower(
      caso(["mpc.candidate_gen = [", "\t2\t0\t0\t50\t-50\t1\t100\t1\t70\t0;\t% GC2", "];"].join("\n")),
    );
    expect(red.proyectos_gen).toMatchObject([{ id: "GC2", bus: "2", pnom: 70, tec: "" }]);
  });
});
