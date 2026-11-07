import { useMemo, useSyncExternalStore } from "react";

export type ProblemSeverity = "error" | "warn" | "info";
export type ProblemTargetKind = "bus" | "line" | "candidate" | "route";

export interface ProblemTarget {
  kind: ProblemTargetKind;
  id: string;
}

/** Either runs something in the app, or leaves it for a page (`href`, e.g. the classic interface). */
export type ProblemAction = { label: string; run: () => void } | { label: string; href: string };

/**
 * One entry of the «Problemas» panel: what is wrong, why, what to do and where it is.
 * `source` tags who reported it (e.g. "catalog", "plan") so that `clear(source)` can drop just those.
 */
export interface Problem {
  id: string;
  severity: ProblemSeverity;
  title: string;
  cause?: string;
  action?: ProblemAction;
  target?: ProblemTarget;
  source?: string;
}

/** Function properties, not methods: they never read `this`, so they can be passed around freely. */
export interface ProblemsStore {
  getList: () => readonly Problem[];
  subscribe: (listener: () => void) => () => void;
  /** Adds a problem; one with the same id replaces the previous entry (retries report again). */
  add: (problem: Problem) => void;
  remove: (id: string) => void;
  /** Removes the problems of one source, or every problem when no source is given. */
  clear: (source?: string) => void;
}

export const SEVERITIES: readonly ProblemSeverity[] = ["error", "warn", "info"];

/** Same report, field by field; `action.run` is a closure that changes on every render and is not compared. */
function sameProblem(a: Problem, b: Problem): boolean {
  return (
    a.id === b.id &&
    a.severity === b.severity &&
    a.title === b.title &&
    a.cause === b.cause &&
    a.source === b.source &&
    a.action?.label === b.action?.label &&
    a.target?.kind === b.target?.kind &&
    a.target?.id === b.target?.id
  );
}

/** A small immutable store; the list is replaced on every change, never mutated. */
export function createProblemsStore(initial: readonly Problem[] = []): ProblemsStore {
  let list: readonly Problem[] = initial;
  const listeners = new Set<() => void>();

  const publish = (next: readonly Problem[]): void => {
    list = next;
    for (const listener of listeners) listener();
  };

  return {
    getList: () => list,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add: (problem) => {
      const index = list.findIndex((entry) => entry.id === problem.id);
      const existing = list[index];
      if (existing && sameProblem(existing, problem)) {
        // A retry reporting the same thing: no churn for subscribers, but keep the fresh object (its
        // action.run closes over the latest state; the old one may be stale).
        list = list.with(index, problem);
        return;
      }
      publish(index === -1 ? [...list, problem] : list.with(index, problem));
    },
    remove: (id) => {
      publish(list.filter((entry) => entry.id !== id));
    },
    clear: (source) => {
      publish(source === undefined ? [] : list.filter((entry) => entry.source !== source));
    },
  };
}

/** The application-wide store; components default to it. Tests create their own with createProblemsStore. */
export const problemsStore: ProblemsStore = createProblemsStore();

export interface UseProblems {
  list: readonly Problem[];
  add: ProblemsStore["add"];
  remove: ProblemsStore["remove"];
  clear: ProblemsStore["clear"];
}

/** Subscribes to the problems list; the actions are stable for the life of the store. */
export function useProblems(store: ProblemsStore = problemsStore): UseProblems {
  const list = useSyncExternalStore(store.subscribe, store.getList, store.getList);
  return useMemo(() => ({ list, add: store.add, remove: store.remove, clear: store.clear }), [list, store]);
}

export function countBySeverity(list: readonly Problem[]): Readonly<Record<ProblemSeverity, number>> {
  return list.reduce<Record<ProblemSeverity, number>>(
    (counts, problem) => ({ ...counts, [problem.severity]: counts[problem.severity] + 1 }),
    { error: 0, warn: 0, info: 0 },
  );
}
