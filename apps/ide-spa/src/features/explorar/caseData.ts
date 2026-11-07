import type { Motor, Sistema } from "@xpand/api";

export interface FoundSystem {
  engine: Motor;
  system: Sistema;
}

/** The catalog's engine and system for the identifiers of a route, when the catalog has them. */
export function findSystem(
  engines: readonly Motor[] | undefined,
  engineId: string | undefined,
  systemId: string | undefined,
): FoundSystem | undefined {
  const engine = engines?.find((entry) => entry.id === engineId);
  const system = engine?.sistemas.find((candidate) => candidate.id === systemId);
  return engine === undefined || system === undefined ? undefined : { engine, system };
}
