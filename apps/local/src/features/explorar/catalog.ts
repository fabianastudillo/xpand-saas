import type { Catalogo, Motor, Sistema } from "@xpand/api";
import { normalizeText } from "@xpand/ui";

/** Size bands in buses: up to 20, up to 100, the rest. */
const SMALL_MAX_BUSES = 20;
const MEDIUM_MAX_BUSES = 100;
const WORD_SEPARATOR = /\s+/;

export const SIZE_BANDS = ["small", "medium", "large"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

export interface CatalogEntry {
  engine: Motor;
  system: Sistema;
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
  return catalog.motores.flatMap((engine) => engine.sistemas.map((system) => ({ engine, system })));
}

export function familiesOfCatalog(catalog: Catalogo): string[] {
  const families = catalog.motores.flatMap((engine) => (engine.familia === undefined ? [] : [engine.familia]));
  return [...new Set(families)];
}

function matchesText(entry: CatalogEntry, text: string): boolean {
  const words = normalizeText(text).split(WORD_SEPARATOR).filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const haystack = normalizeText(`${entry.system.nombre} ${entry.system.id} ${entry.engine.nombre} ${entry.engine.id}`);
  return words.every((word) => haystack.includes(word));
}

export function filterEntries(entries: readonly CatalogEntry[], filters: CatalogFilters): CatalogEntry[] {
  return entries.filter(
    (entry) =>
      (filters.engine === null || entry.engine.id === filters.engine) &&
      (filters.family === null || entry.engine.familia === filters.family) &&
      (filters.size === null || sizeOf(entry.system.barras) === filters.size) &&
      matchesText(entry, filters.text),
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

export function countSystems(catalog: Catalogo): number {
  return catalog.motores.reduce((total, engine) => total + engine.sistemas.length, 0);
}
