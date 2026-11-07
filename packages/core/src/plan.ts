// Reader for the plan contract emitted by every engine: the TypeScript port of
// packages/XpandCore/src/resultados.jl (`leer_plan`). It works on text only.
//
// A plan is a block between `##PLAN_INI##` and `##PLAN_FIN##`, with one record
// per line: `##KV## key=value`, `##IT##`, `##BUS##` and `##GEN##` with fields
// separated by `|`. The last block of the text wins.

import { parseDecimal } from "./numeric";

export type PlanValue = number | string;

export type PlanRecord = Record<string, PlanValue>;

export interface Plan {
  kv: Record<string, PlanValue>;
  items: PlanRecord[];
  buses: PlanRecord[];
  gens: PlanRecord[];
  // The closing marker was seen after the last opening marker.
  completo: boolean;
  // The last block has at least one kv or item record.
  hay_plan: boolean;
}

// Numbers become numbers; anything else stays text, without its outer spaces.
function value(text: string): PlanValue {
  const trimmed = text.trim();
  return parseDecimal(trimmed) ?? trimmed;
}

// Sets a field as an own property, so a key such as `__proto__` stays data.
function setField(target: Record<string, PlanValue>, key: string, field: PlanValue): void {
  Object.defineProperty(target, key, { value: field, enumerable: true, writable: true, configurable: true });
}

// `a=1|b=x|c`: a field without `=` is ignored, and a field with an empty key too.
function recordFields(rest: string): PlanRecord {
  const record: PlanRecord = {};
  for (const part of rest.split("|")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === "") continue;
    setField(record, key, value(part.slice(eq + 1)));
  }
  return record;
}

/**
 * Reads the last plan block of `text`. An empty text, or one without a block,
 * gives an empty plan with `hay_plan` false.
 */
export function readPlan(text: string): Plan {
  let kv: Record<string, PlanValue> = {};
  let items: PlanRecord[] = [];
  let buses: PlanRecord[] = [];
  let gens: PlanRecord[] = [];
  let completo = false;
  let open = false;

  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s.startsWith("##PLAN_INI##")) {
      kv = {};
      items = [];
      buses = [];
      gens = [];
      open = true;
      completo = false;
    } else if (s.startsWith("##PLAN_FIN##")) {
      // As in the Julia reader, the closing marker sets `completo` even without an open block.
      completo = true;
      open = false;
    } else if (open && s.startsWith("##KV##")) {
      const rest = s.slice(6).trim();
      const eq = rest.indexOf("=");
      if (eq === -1) continue;
      setField(kv, rest.slice(0, eq).trim(), value(rest.slice(eq + 1)));
    } else if (open && s.startsWith("##IT##")) {
      items.push(recordFields(s.slice(6).trim()));
    } else if (open && s.startsWith("##BUS##")) {
      buses.push(recordFields(s.slice(7).trim()));
    } else if (open && s.startsWith("##GEN##")) {
      gens.push(recordFields(s.slice(7).trim()));
    }
  }

  return {
    kv,
    items,
    buses,
    gens,
    completo,
    hay_plan: Object.keys(kv).length > 0 || items.length > 0,
  };
}
