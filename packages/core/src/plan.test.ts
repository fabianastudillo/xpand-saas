import { describe, expect, it } from "vitest";
import { readPlan } from "./plan";

const block = (...lines: string[]) => ["##PLAN_INI##", ...lines, "##PLAN_FIN##"].join("\n");

describe("readPlan: block completeness and selection", () => {
  it("reports a complete plan when the closing marker is seen", () => {
    const plan = readPlan(block("##KV## estado=solved"));
    expect(plan.completo).toBe(true);
    expect(plan.hay_plan).toBe(true);
  });

  it("reports an incomplete plan when the closing marker is missing", () => {
    const plan = readPlan("##PLAN_INI##\n##KV## estado=solved\n");
    expect(plan.completo).toBe(false);
    expect(plan.hay_plan).toBe(true);
  });

  it("keeps only the last block of the file", () => {
    const plan = readPlan(
      [block("##KV## estado=timeout", "##IT## tipo=ac|id=L1|copia=1"), block("##KV## estado=solved")].join("\n"),
    );
    expect(plan.kv).toStrictEqual({ estado: "solved" });
    expect(plan.items).toStrictEqual([]);
  });

  it("starts a new block empty, even when the previous one was incomplete", () => {
    const plan = readPlan(["##PLAN_INI##", "##IT## tipo=ac|id=L1|copia=1", block("##KV## estado=solved")].join("\n"));
    expect(plan.items).toStrictEqual([]);
    expect(plan.completo).toBe(true);
  });

  it("reports no plan for an empty file", () => {
    expect(readPlan("")).toStrictEqual({
      kv: {},
      items: [],
      buses: [],
      gens: [],
      completo: false,
      hay_plan: false,
    });
  });

  it("ignores records written outside a block", () => {
    const plan = readPlan("##KV## estado=solved\n" + block("##KV## costo=1"));
    expect(plan.kv).toStrictEqual({ costo: 1 });
  });

  it("sets completo on a closing marker without an open block, as the Julia reader does", () => {
    const plan = readPlan("##PLAN_FIN##\n");
    expect(plan.completo).toBe(true);
    expect(plan.hay_plan).toBe(false);
  });
});

describe("readPlan: record fields", () => {
  it("splits a key-value record at its first '='", () => {
    expect(readPlan(block("##KV## url=a=b")).kv).toStrictEqual({ url: "a=b" });
  });

  it("strips spaces around keys and values", () => {
    expect(readPlan(block("##KV##   gap   =   0.01  ")).kv).toStrictEqual({ gap: 0.01 });
  });

  it("keeps an empty key as an empty string", () => {
    expect(readPlan(block("##KV## =5")).kv).toStrictEqual({ "": 5 });
  });

  it("ignores pipe-separated fields that have no '='", () => {
    const plan = readPlan(block("##IT## tipo=ac|sinvalor|id=C1_2_1|copia=1"));
    expect(plan.items).toStrictEqual([{ tipo: "ac", id: "C1_2_1", copia: 1 }]);
  });

  it("reads numbers as numbers and anything else as text", () => {
    const plan = readPlan(block("##BUS## id=1|v=1.0231|pd=180|estado=solved"));
    expect(plan.buses).toStrictEqual([{ id: 1, v: 1.0231, pd: 180, estado: "solved" }]);
  });

  it("keeps n and copia as independent fields", () => {
    const plan = readPlan(block("##IT## tipo=gen|id=G3|n=3|copia=2"));
    expect(plan.items).toStrictEqual([{ tipo: "gen", id: "G3", n: 3, copia: 2 }]);
  });

  it("reads generator records in order", () => {
    const plan = readPlan(block("##GEN## id=G1|bus=1|pg=148.20", "##GEN## id=G2|bus=3|pg=40"));
    expect(plan.gens).toStrictEqual([
      { id: "G1", bus: 1, pg: 148.2 },
      { id: "G2", bus: 3, pg: 40 },
    ]);
  });

  it("reports hay_plan from kv or items, not from buses or gens alone", () => {
    expect(readPlan(block("##BUS## id=1")).hay_plan).toBe(false);
    expect(readPlan(block("##IT## tipo=ac|id=L1")).hay_plan).toBe(true);
  });
});
