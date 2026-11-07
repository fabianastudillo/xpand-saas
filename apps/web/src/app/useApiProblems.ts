import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure, type ApiError } from "@xpand/api";
import { problemsStore, type Problem } from "@xpand/ui";
import { useEffect, useRef } from "react";
import { useAppText } from "../i18n/messages";
import { apiProblems } from "./apiProblems";

/**
 * Keeps the «Problemas» entries of the failed requests in step with the queries: an error appears, and it goes away
 * when the request succeeds. Callers pass the query errors and memoize the list, so the effect runs when an error
 * changes, not on every render. Anything that is not an ApiFailure is ignored.
 */
export function useApiProblems(errors: readonly unknown[]): void {
  const queryClient = useQueryClient();
  const translate = useAppText();
  const published = useRef<readonly string[]>([]);

  useEffect(() => {
    const apiErrors: ApiError[] = errors.flatMap((error) => (error instanceof ApiFailure ? [error.error] : []));
    const retry = (): void => {
      void queryClient.refetchQueries({ predicate: (query) => query.state.status === "error" });
    };
    const problems: readonly Problem[] = apiProblems(apiErrors, retry, translate);
    const nextIds = problems.map((problem) => problem.id);
    for (const id of published.current) {
      if (!nextIds.includes(id)) problemsStore.remove(id);
    }
    for (const problem of problems) problemsStore.add(problem);
    published.current = nextIds;
  }, [errors, translate, queryClient]);

  useEffect(
    () => () => {
      for (const id of published.current) problemsStore.remove(id);
      published.current = [];
    },
    [],
  );
}
