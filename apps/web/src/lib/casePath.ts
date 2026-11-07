/** Route of a case: `/casos/<motor>/<sistema>`, with both identifiers encoded (accents, spaces, slashes). */
export function casePath(engine: string, system: string): string {
  return `/casos/${encodeURIComponent(engine)}/${encodeURIComponent(system)}`;
}

/** State passed by the navigation from the catalog: the case page then gives the focus to its tree. */
export interface FromCatalogState {
  fromCatalog: true;
}

export const FROM_CATALOG: FromCatalogState = { fromCatalog: true };

export function isFromCatalog(state: unknown): boolean {
  return typeof state === "object" && state !== null && "fromCatalog" in state && state.fromCatalog === true;
}
