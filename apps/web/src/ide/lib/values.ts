/**
 * The contract types the extra fields of a response as `unknown`: these readers take a value out of them.
 * A text or a number that is not there gives undefined (text) or NaN (figure); NaN is shown as «No disponible».
 */
export function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function figureOf(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}
