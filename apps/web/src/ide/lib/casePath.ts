/** Address of the catalog, the zone's start page. */
export const CATALOG_PATH = "/casos";

/** Route of a case: `/casos/<motor>/<sistema>`, with both identifiers encoded (accents, spaces, slashes). */
export function casePath(engine: string, system: string): string {
  return `${CATALOG_PATH}/${encodeURIComponent(engine)}/${encodeURIComponent(system)}`;
}

export interface CaseRef {
  engineId: string;
  systemId: string;
}

const CASE_SEGMENTS = 3;

/**
 * The case an address points to, decoded: `/casos/<motor>/<sistema>` gives both identifiers. Null for the catalog and
 * for any other address (and for a broken percent sequence, which the browser would not have produced).
 */
export function parseCasePath(pathname: string | null): CaseRef | null {
  if (pathname === null) return null;
  const segments = pathname.split("/").slice(1);
  const [root, engine, system] = segments;
  if (segments.length !== CASE_SEGMENTS || root !== CATALOG_PATH.slice(1) || !engine || !system) return null;
  try {
    return { engineId: decodeURIComponent(engine), systemId: decodeURIComponent(system) };
  } catch {
    return null;
  }
}
