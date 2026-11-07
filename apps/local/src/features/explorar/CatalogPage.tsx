import { useCatalogo } from "@xpand/api";
import { NavigationType, useNavigate, useNavigationType, useSearchParams } from "react-router";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { casePath, FROM_CATALOG } from "../../lib/casePath";
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
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [params, setParams] = useSearchParams();
  const urlFilters = useMemo(() => filtersFromSearch(params), [params]);
  // The typed text lives in local state and the address bar follows it. Bound to the URL alone, a fast typist loses
  // keystrokes while the router catches up; the URL is read back only on back and forward.
  const [text, setText] = useState(urlFilters.text);
  useEffect(() => {
    if (navigationType === NavigationType.Pop) setText(urlFilters.text);
  }, [navigationType, urlFilters.text]);
  const filters = useMemo<CatalogFilters>(() => ({ ...urlFilters, text }), [urlFilters, text]);
  const entries = useMemo(() => (catalog.data === undefined ? [] : catalogEntries(catalog.data)), [catalog.data]);
  const visibleEntries = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const families = useMemo(() => (catalog.data === undefined ? [] : familiesOfCatalog(catalog.data)), [catalog.data]);

  const change = (next: CatalogFilters): void => {
    setText(next.text);
    setParams(filtersToParams(next), { replace: true });
  };
  const open = (entry: CatalogEntry): void => {
    void navigate(casePath(entry.engine.id, entry.system.id), { state: FROM_CATALOG });
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
    />
  );
}
