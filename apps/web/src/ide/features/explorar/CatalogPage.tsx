"use client";

import { useCatalogo } from "@xpand/api";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useIdeNavigation } from "../../app/ideContext";
import { casePath, CATALOG_PATH } from "../../lib/casePath";
import { CatalogDocument } from "./CatalogDocument";
import {
  catalogEntries,
  familiesOfCatalog,
  filterEntries,
  filtersFromSearch,
  filtersToParams,
  type CatalogEntry,
  type CatalogFilters,
} from "./catalog";

/**
 * «Explorar casos», the start page: the catalog, filtered, with the filters kept in the address bar. It renders in the
 * layout's document area.
 */
export function CatalogPage(): ReactElement {
  const catalog = useCatalogo();
  const router = useRouter();
  const { arriveFromCatalog } = useIdeNavigation();
  const params = useSearchParams();
  const urlFilters = useMemo(() => filtersFromSearch(params), [params]);
  // The typed text lives in local state and the address bar follows it: bound to the address alone, a fast typist
  // would lose keystrokes while the router catches up. The page mounts anew on every visit, so it starts from the address.
  const [text, setText] = useState(urlFilters.text);
  const filters = useMemo<CatalogFilters>(() => ({ ...urlFilters, text }), [urlFilters, text]);
  const entries = useMemo(() => (catalog.data === undefined ? [] : catalogEntries(catalog.data)), [catalog.data]);
  const visibleEntries = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const families = useMemo(() => (catalog.data === undefined ? [] : familiesOfCatalog(catalog.data)), [catalog.data]);

  // The filters replace the address in place: no history entry and no request to the server for a query change.
  const change = (next: CatalogFilters): void => {
    setText(next.text);
    const query = filtersToParams(next).toString();
    window.history.replaceState(null, "", query === "" ? CATALOG_PATH : `${CATALOG_PATH}?${query}`);
  };
  const open = (entry: CatalogEntry): void => {
    arriveFromCatalog(entry.engine.id, entry.system.id);
    router.push(casePath(entry.engine.id, entry.system.id));
  };

  return (
    <CatalogDocument
      catalog={catalog.data}
      failed={catalog.isError}
      filters={filters}
      families={families}
      visibleEntries={visibleEntries}
      onChange={change}
      onSubmit={open}
      onOpenEntry={arriveFromCatalog}
    />
  );
}
