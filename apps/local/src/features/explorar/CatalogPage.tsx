import { useCatalogo } from "@xpand/api";
import { DocumentTabs } from "@xpand/ui";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { NavigationType, useNavigate, useNavigationType, useSearchParams } from "react-router";
import { casePath, FROM_CATALOG } from "../../lib/casePath";
import { useAppText } from "../../i18n/messages";
import { IdeFrame } from "../../app/IdeFrame";
import { CatalogDocument } from "./CatalogDocument";
import {
  catalogEntries,
  familiesOfCatalog,
  filtersFromSearch,
  filtersToParams,
  filterEntries,
  type CatalogEntry,
  type CatalogFilters,
} from "./catalog";

const CATALOG_DOCUMENT_ID = "catalog";
const noop = (): void => undefined;

/** «Explorar casos», the start page: the catalog, filtered, with the filters kept in the address bar. */
export function CatalogPage(): ReactElement {
  const translate = useAppText();
  const catalog = useCatalogo();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [params, setParams] = useSearchParams();
  const urlFilters = useMemo(() => filtersFromSearch(params), [params]);
  // The typed text lives in local state and the address bar follows it. Bound to the URL alone, a fast typist
  // loses keystrokes while the router catches up; the URL is read back only on back and forward.
  const [text, setTexto] = useState(urlFilters.text);
  useEffect(() => {
    if (navigationType === NavigationType.Pop) setTexto(urlFilters.text);
  }, [navigationType, urlFilters.text]);
  const filters: CatalogFilters = { ...urlFilters, text };
  const entries = useMemo(() => (catalog.data === undefined ? [] : catalogEntries(catalog.data)), [catalog.data]);
  const visibleEntries = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const families = useMemo(() => (catalog.data === undefined ? [] : familiesOfCatalog(catalog.data)), [catalog.data]);
  const title = translate("catalog.title");

  const change = (next: CatalogFilters): void => {
    setTexto(next.text);
    setParams(filtersToParams(next), { replace: true });
  };
  const open = (entry: CatalogEntry): void => {
    void navigate(casePath(entry.engine.id, entry.system.id), { state: FROM_CATALOG });
  };

  return (
    <IdeFrame
      title={title}
      path={[]}
      errors={[catalog.error]}
      center={
        <DocumentTabs
          documents={[{ id: CATALOG_DOCUMENT_ID, title, closable: false }]}
          activeId={CATALOG_DOCUMENT_ID}
          onActivate={noop}
          onClose={noop}
        >
          <CatalogDocument
            catalog={catalog.data}
            failed={catalog.isError}
            filters={filters}
            families={families}
            visibleEntries={visibleEntries}
            onChange={change}
            onSubmit={open}
          />
        </DocumentTabs>
      }
    />
  );
}
