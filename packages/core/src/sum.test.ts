import { describe, expect, it } from "vitest";
import { sumaSecuencial } from "./sum";

describe("sumaSecuencial: the fold of Julia's sum(v; init = 0.0) (decision D1)", () => {
  it("is 0.0 for an empty sequence", () => {
    expect(sumaSecuencial([])).toBe(0);
  });

  it("adds from left to right without regrouping the terms", () => {
    // Left to right: ((1e16 + 1) + 1) = 1e16, because each 1 is lost in the rounding.
    // A regrouped sum (1e16 + (1 + 1)) would keep the 2 and give 1e16 + 2.
    expect(sumaSecuencial([1e16, 1, 1])).toBe(1e16);
  });

  it("matches a sequential loop on more than 32 terms, not a pairwise sum", () => {
    // 1e16 followed by 40 ones: the sequential fold loses every 1 (result 1e16).
    // A pairwise sum groups the ones first and keeps them (1e16 + 40).
    const terms = [1e16, ...Array.from({ length: 40 }, () => 1)];
    let loop = 0.0;
    for (const t of terms) loop += t;
    expect(sumaSecuencial(terms)).toBe(loop);
    expect(sumaSecuencial(terms)).toBe(1e16);
  });
});
