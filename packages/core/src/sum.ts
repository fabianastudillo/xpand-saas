// Left-to-right sum: the TypeScript form of the reductions of Red that Julia
// writes as `sum(v; init = 0.0)` (decision D1 of feature 003). The terms are
// added one after another, in their order, and never regrouped: a pairwise or
// SIMD sum gives other bits (specs/003-port-red-ts/research.md, R2).

/** Sum of `terms` from left to right, starting at 0.0 (`foldl(+, v; init = 0.0)`). */
export function sumaSecuencial(terms: Iterable<number>): number {
  let total = 0.0;
  for (const term of terms) total += term;
  return total;
}
