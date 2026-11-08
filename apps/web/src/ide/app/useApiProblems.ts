import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure, type ApiError } from "@xpand/api";
import type { Problem } from "@xpand/ui";
import { useCallback, useMemo } from "react";
import { useAppText } from "../i18n/messages";
import { apiProblems } from "./apiProblems";
import { usePublishedProblems } from "./usePublishedProblems";

/**
 * Keeps the «Problemas» entries of the failed requests in step with the queries: an error appears, and it goes away
 * when the request succeeds. Callers pass the query errors and memoize the list, so the entries are rebuilt when an
 * error changes, not on every render. Anything that is not an ApiFailure is ignored.
 */
export function useApiProblems(errors: readonly unknown[]): void {
  const queryClient = useQueryClient();
  const translate = useAppText();
  const retry = useCallback((): void => {
    void queryClient.refetchQueries({ predicate: (query) => query.state.status === "error" });
  }, [queryClient]);
  const problems = useMemo<readonly Problem[]>(() => {
    const apiErrors: ApiError[] = errors.flatMap((error) => (error instanceof ApiFailure ? [error.error] : []));
    return apiProblems(apiErrors, retry, translate);
  }, [errors, retry, translate]);
  usePublishedProblems(problems);
}
