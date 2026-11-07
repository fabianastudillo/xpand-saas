import type { Red } from "@xpand/api";
import { CaseTree, Skeleton, formatNumber, problemsStore, t, type TreeGroup } from "@xpand/ui";
import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { useAppText, type Translate } from "../../i18n/messages";
import { figureOf, textOf } from "../../lib/values";
import { caseTreeGroups, type TreeLabels, type Selection } from "./caseTree";

const NOTE_PROBLEM_ID = "case.note";
const NOTE_PROBLEM_SOURCE = "caso";
const TREE_TAB_STOP = '[role="treeitem"][tabindex="0"]';

function treeLabels(translate: Translate): TreeLabels {
  return {
    bus: (name) => translate("case.bus", { name }),
    buses: translate("case.tree.buses"),
    lines: translate("case.tree.lines"),
    candidates: translate("case.tree.candidates"),
  };
}

export interface CaseTreePanelProps {
  red: Red | undefined;
  failed: boolean;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  /** Gives the keyboard focus to the tree when the case was opened from the catalog. */
  focusOnMount: boolean;
}

/** The case tree of the left zone: buses, existing lines and candidate corridors. */
export function CaseTreePanel({ red, failed, selected, onSelect, focusOnMount }: CaseTreePanelProps): ReactElement {
  const translate = useAppText();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const focusGiven = useRef(false);
  const groups = useMemo<readonly TreeGroup[]>(
    () => (red === undefined ? [] : caseTreeGroups(red, treeLabels(translate))),
    [red, translate],
  );

  // Once only: a later data refresh must not take the focus back from wherever the user has moved it.
  useEffect(() => {
    if (!focusOnMount || red === undefined || focusGiven.current) return;
    focusGiven.current = true;
    panelRef.current?.querySelector<HTMLElement>(TREE_TAB_STOP)?.focus();
  }, [focusOnMount, red]);

  if (red === undefined) {
    return failed ? (
      <p role="status" className="p-3 text-sm text-error-ink">
        {translate("case.tree.error")}
      </p>
    ) : (
      <div aria-busy="true" className="flex flex-col gap-2 p-3">
        <span className="xp-sr-only">{t("common.loading")}</span>
        <Skeleton height="1.75rem" />
        <Skeleton height="1.75rem" />
        <Skeleton height="1.75rem" />
      </div>
    );
  }
  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col">
      <CaseTree
        groups={groups}
        onSelect={(group, id) => {
          onSelect({ group, id });
        }}
        {...(selected === null ? {} : { selected: { group: selected.group, id: selected.id } })}
      />
    </div>
  );
}

export interface CaseSummaryProps {
  red: Red | undefined;
  failed: boolean;
}

/** The center document of a case: the network's scheme, base power and reference bus. */
export function CaseSummary({ red, failed }: CaseSummaryProps): ReactElement {
  const translate = useAppText();
  const esquema = red === undefined ? undefined : textOf(red.esquema);
  const sbase = red === undefined ? Number.NaN : figureOf(red.sbase);
  const refbus = red === undefined ? undefined : textOf(red.refbus);
  if (red === undefined) {
    return failed ? (
      <p role="status" className="p-4 text-sm text-error-ink">
        {translate("case.error")}
      </p>
    ) : (
      <p className="p-4 text-sm text-ink-muted" aria-busy="true">
        {t("common.loading")}
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-3 p-4">
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
        {esquema === undefined ? null : (
          <>
            <dt className="text-ink-muted">{translate("case.summary.scheme")}</dt>
            <dd className="m-0">{esquema}</dd>
          </>
        )}
        {Number.isFinite(sbase) ? (
          <>
            <dt className="text-ink-muted">{translate("case.summary.basePower")}</dt>
            <dd className="m-0 font-mono tabular-nums">{`${formatNumber(sbase, { digits: 0 })} MVA`}</dd>
          </>
        ) : null}
        {refbus === undefined ? null : (
          <>
            <dt className="text-ink-muted">{translate("case.summary.refBus")}</dt>
            <dd className="m-0 font-mono tabular-nums">{refbus}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/**
 * The case's note (the catalog's «nota» of the system) as an informative problem, for as long as the case is open.
 * It is a note, not an error: the data is still usable, and the text says what is special about it.
 */
export function useCaseNote(nota: string | undefined): void {
  const translate = useAppText();
  useEffect(() => {
    if (nota === undefined) return;
    problemsStore.add({
      id: NOTE_PROBLEM_ID,
      severity: "info",
      title: translate("case.note"),
      cause: nota,
      source: NOTE_PROBLEM_SOURCE,
    });
    return () => {
      problemsStore.remove(NOTE_PROBLEM_ID);
    };
  }, [nota, translate]);
}
