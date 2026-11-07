import type { ApiError } from "@xpand/api";
import { t, type Problem } from "@xpand/ui";
import { appText } from "../i18n/messages";

const PROBLEM_SOURCE = "api";
const CLASSIC_INTERFACE_HREF = "/";

/**
 * The «Problemas» entries for the failed requests. Each kind is reported once (a session that is missing blocks
 * every route; one entry says so), and HTTP and schema errors name their route. The retry is shared: it
 * refetches every query that failed.
 */
export function apiProblems(errors: readonly ApiError[], retry: () => void): Problem[] {
  const byId = new Map<string, Problem>();
  for (const error of errors) {
    const problem = problemFor(error, retry);
    if (!byId.has(problem.id)) byId.set(problem.id, { ...problem, source: PROBLEM_SOURCE });
  }
  return [...byId.values()];
}

function problemFor(error: ApiError, retry: () => void): Problem {
  switch (error.kind) {
    case "auth":
      return {
        id: "api.auth",
        severity: "error",
        title: appText("problems.auth.title"),
        cause: appText("problems.auth.cause"),
        action: { label: appText("problems.auth.action"), href: CLASSIC_INTERFACE_HREF },
      };
    case "network":
      return {
        id: "api.network",
        severity: "error",
        title: appText("problems.network.title"),
        cause: appText("problems.network.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    case "http":
      return {
        id: `api.http:${error.route}`,
        severity: "error",
        title: appText("problems.http.title"),
        cause: appText("problems.http.cause", { route: error.route, status: error.status ?? "?" }),
        action: { label: t("common.retry"), run: retry },
      };
    case "schema":
      return {
        id: `api.schema:${error.route}`,
        severity: "error",
        title: appText("problems.schema.title"),
        cause: appText("problems.schema.cause", { route: error.route, detail: error.message }),
        action: { label: t("common.retry"), run: retry },
      };
  }
}
