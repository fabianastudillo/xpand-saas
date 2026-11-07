import type { Red } from "@xpand/api";
import { Inspector, InspectorRow, InspectorRows } from "@xpand/ui";
import type { ReactElement } from "react";
import { useAppText, type TranslateFn } from "../../i18n/messages";
import { figureOf } from "../../lib/values";
import { selectedElement, type SelectedElement, type Selection } from "./caseTree";

const MW = "MW";
const MVAR = "MVAr";
const MVA = "MVA";
const PU = "pu";
const DIGITS_POWER = 1;
const DIGITS_VOLTAGE = 2;
const DIGITS_IMPEDANCE = 3;
const DIGITS_COUNT = 0;

export interface CaseInspectorProps {
  red: Red | undefined;
  selection: Selection | null;
}

/** The right zone: the figures of the selected bus, line or candidate. Empty until something is selected. */
export function CaseInspector({ red, selection }: CaseInspectorProps): ReactElement {
  const translate = useAppText();
  const element = red === undefined ? null : selectedElement(red, selection);
  if (element === null) return <Inspector />;
  return <Inspector title={titleOf(element, translate)}>{rows(element, translate)}</Inspector>;
}

function titleOf(element: SelectedElement, translate: TranslateFn): string {
  switch (element.kind) {
    case "bus":
      return translate("case.bus", { name: element.bus.nombre });
    case "line":
      return `${element.line.de} – ${element.line.a}`;
    case "candidate":
      return `${element.candidate.de} – ${element.candidate.a}`;
  }
}

function rows(element: SelectedElement, translate: TranslateFn): ReactElement {
  switch (element.kind) {
    case "bus": {
      const bus = element.bus;
      return (
        <InspectorRows>
          <InspectorRow label={translate("case.bus.activeLoad")} value={bus.pd} unit={MW} digits={DIGITS_POWER} />
          <InspectorRow label={translate("case.bus.reactiveLoad")} value={bus.qd} unit={MVAR} digits={DIGITS_POWER} />
          <InspectorRow label={translate("case.bus.maxGeneration")} value={figureOf(bus.pgmax)} unit={MW} digits={DIGITS_POWER} />
          <InspectorRow label={translate("case.bus.minVoltage")} value={bus.vmin} unit={PU} digits={DIGITS_VOLTAGE} />
          <InspectorRow label={translate("case.bus.maxVoltage")} value={bus.vmax} unit={PU} digits={DIGITS_VOLTAGE} />
        </InspectorRows>
      );
    }
    case "line": {
      const line = element.line;
      return (
        <InspectorRows>
          <InspectorRow label={translate("case.line.from")} value={line.de} />
          <InspectorRow label={translate("case.line.to")} value={line.a} />
          <InspectorRow label={translate("case.line.r")} value={line.r} unit={PU} digits={DIGITS_IMPEDANCE} />
          <InspectorRow label={translate("case.line.x")} value={line.x} unit={PU} digits={DIGITS_IMPEDANCE} />
          <InspectorRow label={translate("case.line.s")} value={line.s} unit={MVA} digits={DIGITS_POWER} />
        </InspectorRows>
      );
    }
    case "candidate": {
      const candidate = element.candidate;
      return (
        <InspectorRows>
          <InspectorRow label={translate("case.candidate.cost")} value={candidate.costo} digits={DIGITS_POWER} />
          <InspectorRow label={translate("case.candidate.maxCircuits")} value={candidate.nmax} digits={DIGITS_COUNT} />
          <InspectorRow label={translate("case.line.r")} value={candidate.r} unit={PU} digits={DIGITS_IMPEDANCE} />
          <InspectorRow label={translate("case.line.x")} value={candidate.x} unit={PU} digits={DIGITS_IMPEDANCE} />
          <InspectorRow label={translate("case.line.s")} value={candidate.s} unit={MVA} digits={DIGITS_POWER} />
        </InspectorRows>
      );
    }
  }
}
