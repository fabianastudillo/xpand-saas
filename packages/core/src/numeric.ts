// Decimal grammar shared by the readers: the numbers that Julia's
// tryparse(Float64, t) accepts on the tokens of the shared fixtures
// (specs/002-port-lectores-ts/research.md, R2). `d`/`D` exponents, hexadecimal
// literals and Inf/NaN are outside the TypeScript port.
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** The number that `text` spells in the decimal grammar, or undefined. */
export function parseDecimal(text: string): number | undefined {
  return DECIMAL.test(text) ? Number(text) : undefined;
}
