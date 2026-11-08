import { problemsStore, type Problem } from "@xpand/ui";
import { useEffect, useRef } from "react";

/**
 * Keeps the «Problemas» entries of one origin in step with a list: an entry appears with the list, is replaced when
 * its id comes again, and goes away when the list no longer has it (or the component unmounts). Callers memoize the
 * list, so the effect runs when it changes, not on every render.
 */
export function usePublishedProblems(problems: readonly Problem[]): void {
  const published = useRef<readonly string[]>([]);

  useEffect(() => {
    const nextIds = problems.map((problem) => problem.id);
    for (const id of published.current) {
      if (!nextIds.includes(id)) problemsStore.remove(id);
    }
    for (const problem of problems) problemsStore.add(problem);
    published.current = nextIds;
  }, [problems]);

  useEffect(
    () => () => {
      for (const id of published.current) problemsStore.remove(id);
      published.current = [];
    },
    [],
  );
}
