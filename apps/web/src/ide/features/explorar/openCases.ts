/** A case open as a document tab of the shell. The tabs live in the layout, so they survive navigation. */
export interface OpenCase {
  key: string;
  engineId: string;
  systemId: string;
  title: string;
}

const KEY_SEPARATOR = "/";

export function caseKey(engineId: string, systemId: string): string {
  return `${engineId}${KEY_SEPARATOR}${systemId}`;
}

/** Adds the case, or refreshes its title. Returns the same list when nothing changed (no re-render follows). */
export function upsertOpenCase(list: readonly OpenCase[], next: OpenCase): readonly OpenCase[] {
  const index = list.findIndex((entry) => entry.key === next.key);
  if (index === -1) return [...list, next];
  const current = list[index];
  if (current === undefined || current.title === next.title) return list;
  return list.with(index, next);
}

export function withoutOpenCase(list: readonly OpenCase[], key: string): readonly OpenCase[] {
  return list.some((entry) => entry.key === key) ? list.filter((entry) => entry.key !== key) : list;
}
