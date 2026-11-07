/**
 * The technologies M0 opens a case with: the AC candidate corridors only (the catalog names no default; the study
 * form of M1 will let the user choose). The catalog row and the opened case must agree on this set: the reference
 * value shown in the row is the one of this variant.
 */
export const CASE_TECHNOLOGIES: readonly string[] = ["ac"];

const TECHNOLOGY_SEPARATOR = ",";

/** The canonical text of a set of technologies, as the catalog writes it: sorted, comma-separated, no spaces. */
export function technologiesKey(technologies: readonly string[]): string {
  return [...technologies]
    .map((technology) => technology.trim())
    .filter((technology) => technology !== "")
    .sort()
    .join(TECHNOLOGY_SEPARATOR);
}
