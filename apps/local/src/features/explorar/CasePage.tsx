import { useCatalogo, useRed, type Motor, type Sistema } from "@xpand/api";
import { DocumentTabs } from "@xpand/ui";
import { useMemo, type ReactElement } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { IdeFrame } from "../../app/IdeFrame";
import { isFromCatalog } from "../../lib/casePath";
import { textOf } from "../../lib/values";
import { CaseInspector } from "./CaseInspector";
import { CaseSummary, CaseTreePanel, useCaseNote } from "./CaseDocument";
import { formatSelection, parseSelection, type Selection } from "./caseTree";

/** Technologies the case tree asks the server for: the AC candidate corridors. */
const DEFAULT_TECHS = ["ac"];
const SELECTION_PARAM = "sel";
const CASE_DOCUMENT_ID = "case";
const noop = (): void => undefined;

/** The route /casos/:motor/:sistema. Parameters arrive decoded, accents and slashes included. */
export function CasePage(): ReactElement {
  const params = useParams();
  const engineId = params.motor;
  const systemId = params.sistema;
  if (engineId === undefined || systemId === undefined) return <Navigate to="/" replace />;
  return <CaseView engineId={engineId} systemId={systemId} />;
}

interface CaseViewProps {
  engineId: string;
  systemId: string;
}

interface FoundSystem {
  engine: Motor;
  system: Sistema;
}

function findSystem(engines: readonly Motor[] | undefined, engineId: string, systemId: string): FoundSystem | undefined {
  const engine = engines?.find((entry) => entry.id === engineId);
  const system = engine?.sistemas.find((candidate) => candidate.id === systemId);
  return engine === undefined || system === undefined ? undefined : { engine, system };
}

function CaseView({ engineId, systemId }: CaseViewProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const catalog = useCatalogo();
  const redQuery = useMemo(() => ({ motor: engineId, sistema: systemId, tec: DEFAULT_TECHS }), [engineId, systemId]);
  const red = useRed(redQuery);
  const found = findSystem(catalog.data?.motores, engineId, systemId);
  const caseName = textOf(red.data?.nombre_sistema);
  const systemName = found?.system.nombre ?? caseName ?? systemId;
  const engineName = found?.engine.nombre ?? engineId;
  const selection = parseSelection(params.get(SELECTION_PARAM));
  useCaseNote(found?.system.nota);

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
  const close = (): void => {
    void navigate("/");
  };

  return (
    <IdeFrame
      title={systemName}
      path={[engineName, systemName]}
      errors={[red.error]}
      onCloseDocument={close}
      left={
        <CaseTreePanel
          red={red.data}
          failed={red.isError}
          selected={selection}
          onSelect={select}
          focusOnMount={isFromCatalog(location.state)}
        />
      }
      right={<CaseInspector red={red.data} selection={selection} />}
      center={
        <DocumentTabs
          documents={[{ id: CASE_DOCUMENT_ID, title: systemName }]}
          activeId={CASE_DOCUMENT_ID}
          onActivate={noop}
          onClose={close}
        >
          <CaseSummary red={red.data} failed={red.isError} />
        </DocumentTabs>
      }
    />
  );
}
