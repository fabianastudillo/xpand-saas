import type { Barra, LineaCandidata, LineaExistente, Red } from "@xpand/api";
import type { TreeGroup } from "@xpand/ui";

const GROUP_BUSES = "buses";
const GROUP_LINES = "lines";
const GROUP_CANDIDATES = "candidates";
const SELECTION_SEPARATOR = ":";
const LINE_SEPARATOR = " – ";

/** Labels the tree takes from the translator (the case tree itself has no texts of its own). */
export interface TreeLabels {
  bus: (name: string) => string;
  buses: string;
  lines: string;
  candidates: string;
}

export interface Selection {
  group: string;
  id: string;
}

export type SelectedElement =
  | { kind: "bus"; bus: Barra }
  | { kind: "line"; line: LineaExistente }
  | { kind: "candidate"; candidate: LineaCandidata };

function lineLabel(de: string, a: string): string {
  return `${de}${LINE_SEPARATOR}${a}`;
}

/** The case as the tree shows it: buses, existing lines and candidate corridors, each with its count. */
export function caseTreeGroups(red: Red, labels: TreeLabels): TreeGroup[] {
  return [
    {
      id: GROUP_BUSES,
      label: labels.buses,
      count: red.barras.length,
      items: red.barras.map((bus) => ({ id: bus.id, label: labels.bus(bus.nombre) })),
    },
    {
      id: GROUP_LINES,
      label: labels.lines,
      count: red.ac_existentes.length,
      items: red.ac_existentes.map((line) => ({ id: line.id, label: lineLabel(line.de, line.a) })),
    },
    {
      id: GROUP_CANDIDATES,
      label: labels.candidates,
      count: red.ac_candidatos.length,
      items: red.ac_candidatos.map((candidate) => ({ id: candidate.id, label: lineLabel(candidate.de, candidate.a) })),
    },
  ];
}

export function selectedElement(red: Red, selection: Selection | null): SelectedElement | null {
  if (selection === null) return null;
  if (selection.group === GROUP_BUSES) {
    const bus = red.barras.find((entry) => entry.id === selection.id);
    return bus === undefined ? null : { kind: "bus", bus };
  }
  if (selection.group === GROUP_LINES) {
    const line = red.ac_existentes.find((entry) => entry.id === selection.id);
    return line === undefined ? null : { kind: "line", line };
  }
  if (selection.group === GROUP_CANDIDATES) {
    const candidate = red.ac_candidatos.find((entry) => entry.id === selection.id);
    return candidate === undefined ? null : { kind: "candidate", candidate };
  }
  return null;
}

/** The selection in the address bar: `group:id`, split at the first colon so that an id may contain one. */
export function formatSelection(selection: Selection): string {
  return `${selection.group}${SELECTION_SEPARATOR}${selection.id}`;
}

export function parseSelection(value: string | null): Selection | null {
  if (value === null) return null;
  const index = value.indexOf(SELECTION_SEPARATOR);
  if (index <= 0 || index === value.length - 1) return null;
  return { group: value.slice(0, index), id: value.slice(index + 1) };
}
