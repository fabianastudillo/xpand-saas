import type { UseQueryResult } from "@tanstack/react-query";
import { useCatalogo, useRed, type ApiFailure, type Red } from "@xpand/api";
import { DocumentTabs, type ShellDocument } from "@xpand/ui";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Outlet, useLocation, useMatch, useNavigate, useSearchParams } from "react-router";
import { CaseInspector } from "../features/explorar/CaseInspector";
import { CaseTreePanel, useCaseNote } from "../features/explorar/CaseDocument";
import { findSystem } from "../features/explorar/caseData";
import { textOf } from "../lib/values";
import { caseKey, upsertOpenCase, withoutOpenCase, type OpenCase } from "../features/explorar/openCases";
import { formatSelection, parseSelection, type Selection } from "../features/explorar/caseTree";
import { CASE_TECHNOLOGIES } from "../features/explorar/technologies";
import { casePath, isFromCatalog } from "../lib/casePath";
import { useAppText } from "../i18n/messages";
import { IdeFrame } from "./IdeFrame";

const CASE_PATTERN = "/casos/:motor/:sistema";
const SELECTION_PARAM = "sel";
const CATALOG_TAB_ID = "catalog";
const APP_NAME = "XPAND";

/** What the layout hands to the page of the route, through the outlet context. */
export interface LayoutOutlet {
  red: UseQueryResult<Red, ApiFailure>;
}

/**
 * The shell of every route. It persists across navigation: the zones keep their state, the palette and the
 * «Problemas» entries stay, and the documents are tabs (the catalog, and each case opened). The route's page renders
 * inside the document area through the outlet.
 */
export function AppLayout(): ReactElement {
  const translate = useAppText();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const caseMatch = useMatch(CASE_PATTERN);
  const engineId = caseMatch?.params.motor;
  const systemId = caseMatch?.params.sistema;
  const key = engineId !== undefined && systemId !== undefined ? caseKey(engineId, systemId) : null;

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
  const found = findSystem(catalog.data?.motores, engineId, systemId);
  const systemName = found?.system.nombre ?? textOf(red.data?.nombre_sistema) ?? systemId ?? "";
  const engineName = found?.engine.nombre ?? engineId ?? "";
  const selection = parseSelection(params.get(SELECTION_PARAM));
  const [openCases, setOpenCases] = useState<readonly OpenCase[]>([]);
  useCaseNote(found?.system.nota);

  useEffect(() => {
    if (key === null || engineId === undefined || systemId === undefined) return;
    setOpenCases((current) => upsertOpenCase(current, { key, engineId, systemId, title: systemName }));
  }, [key, engineId, systemId, systemName]);

  const catalogTitle = translate("catalog.title");
  const title = key === null ? catalogTitle : systemName;
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  const select = (next: Selection): void => {
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set(SELECTION_PARAM, formatSelection(next));
        return updated;
      },
      { replace: true },
    );
  };

  const closeCase = (closing: string): void => {
    setOpenCases((current) => withoutOpenCase(current, closing));
    if (closing === key) void navigate("/");
  };

  const activate = (id: string): void => {
    if (id === CATALOG_TAB_ID) {
      void navigate("/");
      return;
    }
    const opened = openCases.find((entry) => entry.key === id);
    if (opened !== undefined) void navigate(casePath(opened.engineId, opened.systemId));
  };

  const documents: readonly ShellDocument[] = [
    { id: CATALOG_TAB_ID, title: catalogTitle, closable: false },
    ...openCases.map((entry) => ({ id: entry.key, title: entry.title })),
  ];
  const outlet: LayoutOutlet = { red };

  return (
    <IdeFrame
      title={title}
      path={key === null ? [] : [engineName, systemName]}
      errors={redErrors}
      onCloseDocument={
        key === null
          ? undefined
          : () => {
              closeCase(key);
            }
      }
      left={
        caseMatch === null ? undefined : (
          <CaseTreePanel
            red={red.data}
            failed={red.isError}
            selected={selection}
            onSelect={select}
            focusOnMount={isFromCatalog(location.state)}
          />
        )
      }
      right={caseMatch === null ? undefined : <CaseInspector red={red.data} selection={selection} />}
      center={
        <DocumentTabs documents={documents} activeId={key ?? CATALOG_TAB_ID} onActivate={activate} onClose={closeCase}>
          <Outlet context={outlet} />
        </DocumentTabs>
      }
    />
  );
}
