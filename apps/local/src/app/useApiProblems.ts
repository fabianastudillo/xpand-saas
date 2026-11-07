import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure, type ApiError } from "@xpand/api";
import { problemsStore, useLocale, type Problem } from "@xpand/ui";
import { useEffect, useRef } from "react";
import { apiProblems } from "./apiProblems";

function errorKey(error: ApiError): string {
  return [error.kind, error.route, String(error.status ?? ""), error.message].join("|");
}

/**
 * Keeps the «Problemas» entries of the failed requests in step with the queries: an error appears, and it goes
 * away when the request succeeds. `errors` are the query errors (anything that is not an ApiFailure is ignored).
 */
export function useApiProblems(errors: readonly unknown[]): void {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const apiErrors = errors.flatMap((error) => (error instanceof ApiFailure ? [error.error] : []));
  const signature = apiErrors.map(errorKey).join("\n");
  const published = useRef<readonly string[]>([]);

  useEffect(() => {
    const retry = (): void => {
      void queryClient.refetchQueries({ predicate: (query) => query.state.status === "error" });
    };
    const problems: readonly Problem[] = apiProblems(apiErrors, retry);
    const nextIds = problems.map((problem) => problem.id);
    for (const id of published.current) {
      if (!nextIds.includes(id)) problemsStore.remove(id);
    }
    for (const problem of problems) problemsStore.add(problem);
    published.current = nextIds;
    // apiErrors is derived from `signature`, which is the value that changes when the errors do.
  }, [signature, locale, queryClient]);

  useEffect(
    () => () => {
      for (const id of published.current) problemsStore.remove(id);
      published.current = [];
    },
    [],
  );
}
