import type {
  Barra as BarraWire,
  IdBarra,
  LineaCandidata as LineaCandidataWire,
  LineaExistente as LineaExistenteWire,
  Red as RedWire,
} from "./generated/red";

/**
 * The network as the interface reads it. The contract (red.schema.json, `idBarra`) admits a bus identifier as a
 * string or an integer, because the «real» engine of the server (red_real) emits integers and M0 does not change
 * the server. Here, and only here, every identifier becomes a string: the tree, the inspector and the selection in
 * the address bar never see a number. Everything else is the wire shape.
 */
export type Barra = BarraWire & { id: string };
export type LineaExistente = LineaExistenteWire & { de: string; a: string };
export type LineaCandidata = LineaCandidataWire & { de: string; a: string };
/** Declared field by field (not as an intersection) so that `barras` is exactly `Barra[]`, not two array types. */
export interface Red {
  barras: Barra[];
  ac_existentes: LineaExistente[];
  ac_candidatos: LineaCandidata[];
  [k: string]: unknown;
}

function idText(id: IdBarra): string {
  return typeof id === "number" ? String(id) : id;
}

/** A new network with every bus identifier as text; the input is not touched. */
export function normalizeRed(red: RedWire): Red {
  return {
    ...red,
    barras: red.barras.map((bus) => ({ ...bus, id: idText(bus.id) })),
    ac_existentes: red.ac_existentes.map((line) => ({ ...line, de: idText(line.de), a: idText(line.a) })),
    ac_candidatos: red.ac_candidatos.map((candidate) => ({ ...candidate, de: idText(candidate.de), a: idText(candidate.a) })),
  };
}
