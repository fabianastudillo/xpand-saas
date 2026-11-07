import { useCatalogo, useRed } from "@xpand/api";
import { DocumentTabs, type ShellDocument } from "@xpand/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { CaseTreePanel, useCaseNote } from "../features/explorar/CaseDocument";
import { CaseInspector } from "../features/explorar/CaseInspector";
import { findSystem } from "../features/explorar/caseData";
import { formatSelection, parseSelection, type Selection } from "../features/explorar/caseTree";
import { caseKey, upsertOpenCase, withoutOpenCase, type OpenCase } from "../features/explorar/openCases";
import { CASE_TECHNOLOGIES } from "../features/explorar/technologies";
import { useAppText } from "../i18n/messages";
import { casePath, CATALOG_PATH, parseCasePath, parseStrayCasePath } from "../lib/casePath";
import { textOf } from "../lib/values";
import { isCaseNotFound } from "./caseErrors";
import { CaseContext, IdeNavigationContext, type CaseContextValue, type IdeNavigationValue } from "./ideContext";
import { IdeFrame } from "./IdeFrame";

const SELECTION_PARAM = "sel";
const CATALOG_TAB_ID = "catalog";
/** Tab of an address under the catalog that is not a case (`/casos/<segmento>`): shown, never kept open. */
const STRAY_TAB_ID = "stray";
const APP_NAME = "XPAND";

export interface IdeLayoutProps {
  /** The page of the route (the catalog or a case), drawn in the document area. */
  children: ReactNode;
}

/**
 * The shell of every route of the zone. It persists across navigation (it is the layout of the route group): the
 * zones keep their state, the palette and the «Problemas» entries stay, and the documents are tabs (the catalog, and
 * each case opened). The route's page renders inside the document area as `children`.
 */
export function IdeLayout({ children }: IdeLayoutProps): ReactElement {
  const translate = useAppText();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const caseRef = parseCasePath(pathname);
  const engineId = caseRef?.engineId;
  const systemId = caseRef?.systemId;
  const key = engineId !== undefined && systemId !== undefined ? caseKey(engineId, systemId) : null;
  // `/casos/<segmento>`: not a case, shown as «case not found» like one the server does not have.
  const stray = parseStrayCasePath(pathname);

  const catalog = useCatalogo();
  const redQuery = useMemo(
    () =>
      engineId === undefined || systemId === undefined
        ? null
        : { motor: engineId, sistema: systemId, tec: [...CASE_TECHNOLOGIES] },
    [engineId, systemId],
  );
  const red = useRed(redQuery);
  const redErrors = useMemo(() => [red.error], [red.error]);
  // The key of the case in the address when the server says it does not exist (also: is not published).
  const notFoundKey = key !== null && isCaseNotFound(red.error) ? key : null;
  const notFound = notFoundKey !== null;
  const found = findSystem(catalog.data?.motores, engineId, systemId);
  const systemName = found?.system.nombre ?? textOf(red.data?.nombre_sistema) ?? systemId ?? "";
  const engineName = found?.engine.nombre ?? engineId ?? "";
  const selection = parseSelection(params.get(SELECTION_PARAM));
  const [openCases, setOpenCases] = useState<readonly OpenCase[]>([]);
  const [arrival, setArrival] = useState<string | null>(null);
  useCaseNote(found?.system.nota);

  // A case the server does not have is not kept as an open document (it is shown, once, in the tab of the address).
  useEffect(() => {
    if (key === null || engineId === undefined || systemId === undefined) return;
    if (notFound) {
      setOpenCases((current) => withoutOpenCase(current, key));
      return;
    }
    setOpenCases((current) => upsertOpenCase(current, { key, engineId, systemId, title: systemName }));
  }, [key, engineId, systemId, systemName, notFound]);

  // The focus goes to the tree only on the arrival from the catalog; any other navigation forgets it.
  useEffect(() => {
    setArrival((current) => (current === key ? current : null));
  }, [key]);

  const catalogTitle = translate("catalog.title");
  const title =
    key === null ? (stray === null ? catalogTitle : translate("case.notFound")) : notFound ? translate("case.notFound") : systemName;

  // The selection lives in the address, replaced in place (no history entry, no request to the server).
  const select = (next: Selection): void => {
    const updated = new URLSearchParams(window.location.search);
    updated.set(SELECTION_PARAM, formatSelection(next));
    window.history.replaceState(null, "", `${window.location.pathname}?${updated.toString()}`);
  };

  const closeCase = (closing: string): void => {
    setOpenCases((current) => withoutOpenCase(current, closing));
    if (closing === key || closing === STRAY_TAB_ID) router.push(CATALOG_PATH);
  };

  const activate = (id: string): void => {
    if (id === CATALOG_TAB_ID) {
      router.push(CATALOG_PATH);
      return;
    }
    const opened = openCases.find((entry) => entry.key === id);
    if (opened !== undefined) router.push(casePath(opened.engineId, opened.systemId));
  };

  const documents: readonly ShellDocument[] = [
    { id: CATALOG_TAB_ID, title: catalogTitle, closable: false },
    ...openCases.filter((entry) => entry.key !== notFoundKey).map((entry) => ({ id: entry.key, title: entry.title })),
    ...(notFoundKey === null ? [] : [{ id: notFoundKey, title: systemName }]),
    ...(stray === null ? [] : [{ id: STRAY_TAB_ID, title: stray }]),
  ];
  const activeId = key ?? (stray === null ? CATALOG_TAB_ID : STRAY_TAB_ID);
  const caseContext = useMemo<CaseContextValue>(() => ({ red }), [red]);
  const navigation = useMemo<IdeNavigationValue>(
    () => ({
      arriveFromCatalog: (arrivingEngine, arrivingSystem) => {
        setArrival(caseKey(arrivingEngine, arrivingSystem));
      },
    }),
    [],
  );

  return (
    <IdeNavigationContext.Provider value={navigation}>
      <CaseContext.Provider value={caseContext}>
        {/* React hoists it into <head>: the page's title (WCAG 2.4.2) replaces the shell's «XPAND». */}
        <title>{`${title} · ${APP_NAME}`}</title>
        <IdeFrame
          title={title}
          path={key === null ? [] : [engineName, systemName]}
          errors={redErrors}
          onCloseDocument={
            key === null && stray === null
              ? undefined
              : () => {
                  closeCase(key ?? STRAY_TAB_ID);
                }
          }
          left={
            caseRef === null ? undefined : (
              <CaseTreePanel
                red={red.data}
                failed={red.isError}
                selected={selection}
                onSelect={select}
                focusOnMount={arrival === key}
              />
            )
          }
          right={caseRef === null ? undefined : <CaseInspector red={red.data} selection={selection} />}
          center={
            <DocumentTabs documents={documents} activeId={activeId} onActivate={activate} onClose={closeCase}>
              {children}
            </DocumentTabs>
          }
        />
      </CaseContext.Provider>
    </IdeNavigationContext.Provider>
  );
}
