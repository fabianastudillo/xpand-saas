import type { Catalogo, Motor, Sistema } from "@xpand/api";
import { normalizeText } from "@xpand/ui";
import { textOf } from "../../lib/values";
import { technologiesKey } from "./technologies";

/** Size bands in buses: up to 20, up to 100, the rest. */
const SMALL_MAX_BUSES = 20;
const MEDIUM_MAX_BUSES = 100;
const WORD_SEPARATOR = /\s+/;

export const SIZE_BANDS = ["small", "medium", "large"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

export interface CatalogEntry {
  engine: Motor;
  system: Sistema;
  /** Names and identifiers, normalized once when the catalog is read (the text filter runs on every keystroke). */
  searchText: string;
}

export interface CatalogFilters {
  /** Free text: every word must appear in the names or identifiers, ignoring case and accents. */
  text: string;
  engine: string | null;
  /** Formulation family: the motor's field `familia` (not its prose `formulacion`). */
  family: string | null;
  size: SizeBand | null;
}

export const EMPTY_FILTERS: CatalogFilters = { text: "", engine: null, family: null, size: null };

export function sizeOf(barras: number): SizeBand {
  if (barras <= SMALL_MAX_BUSES) return "small";
  if (barras <= MEDIUM_MAX_BUSES) return "medium";
  return "large";
}

export function catalogEntries(catalog: Catalogo): CatalogEntry[] {
  return catalog.motores.flatMap((engine) =>
    engine.sistemas.map((system) => ({
      engine,
      system,
      searchText: normalizeText(`${system.nombre} ${system.id} ${engine.nombre} ${engine.id}`),
    })),
  );
}

export function familiesOfCatalog(catalog: Catalogo): string[] {
  const families = catalog.motores.flatMap((engine) => (engine.familia === undefined ? [] : [engine.familia]));
  return [...new Set(families)];
}

/** The words of a free-text query, normalized: parsed once per filter run, not once per entry. */
function queryWords(text: string): readonly string[] {
  return normalizeText(text).split(WORD_SEPARATOR).filter((word) => word.length > 0);
}

export function filterEntries(entries: readonly CatalogEntry[], filters: CatalogFilters): CatalogEntry[] {
  const words = queryWords(filters.text);
  return entries.filter(
    (entry) =>
      (filters.engine === null || entry.engine.id === filters.engine) &&
      (filters.family === null || entry.engine.familia === filters.family) &&
      (filters.size === null || sizeOf(entry.system.barras) === filters.size) &&
      words.every((word) => entry.searchText.includes(word)),
  );
}

function emptyToNull(value: string | null): string | null {
  return value === null || value === "" ? null : value;
}

function parseSizeBand(value: string | null): SizeBand | null {
  return SIZE_BANDS.find((size) => size === value) ?? null;
}

/** The filters as query parameters (only those in use), so that the address bar keeps the catalog state. */
export function filtersToParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.text !== "") params.set("q", filters.text);
  if (filters.engine !== null) params.set("engine", filters.engine);
  if (filters.family !== null) params.set("family", filters.family);
  if (filters.size !== null) params.set("size", filters.size);
  return params;
}

export function filtersFromSearch(params: URLSearchParams): CatalogFilters {
  return {
    text: params.get("q") ?? "",
    engine: emptyToNull(params.get("engine")),
    family: emptyToNull(params.get("family")),
    size: parseSizeBand(params.get("size")),
  };
}

/**
 * The reference value of a system for one set of technologies, or undefined. A system publishes several references
 * (Garver 6 has seven: ac, ac+hvdc, all…), the contract fixes neither their order nor a unit, and only `tecnologias`
 * (an extra field, text like "ac,bancos") says which variant each one is. A reference that does not say is never
 * shown: a figure without its variant would read as «the» optimum of the case.
 */
export function referenceFor(system: Sistema, technologies: readonly string[]): number | undefined {
  const wanted = technologiesKey(technologies);
  const match = system.referencias?.find((reference) => {
    const declared = textOf(reference["tecnologias"]);
    return declared !== undefined && technologiesKey(declared.split(",")) === wanted;
  });
  return match?.valor;
}

export function countSystems(catalog: Catalogo): number {
  return catalog.motores.reduce((total, engine) => total + engine.sistemas.length, 0);
}
