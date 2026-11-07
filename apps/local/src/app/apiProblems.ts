import type { ApiError } from "@xpand/api";
import { t, type Problem } from "@xpand/ui";
import type { Translate } from "../i18n/messages";

const PROBLEM_SOURCE = "api";
const CLASSIC_INTERFACE_HREF = "/";

/**
 * The «Problemas» entries for the failed requests. Each kind is reported once (a session that is missing blocks
 * every route; one entry says so), and HTTP and schema errors name their route. The retry is shared: it
 * refetches every query that failed.
 */
export function apiProblems(errors: readonly ApiError[], retry: () => void, translate: Translate): Problem[] {
  const byId = new Map<string, Problem>();
  for (const error of errors) {
    const problem = problemFor(error, retry, translate);
    if (!byId.has(problem.id)) byId.set(problem.id, { ...problem, source: PROBLEM_SOURCE });
  }
  return [...byId.values()];
}

function problemFor(error: ApiError, retry: () => void, translate: Translate): Problem {
  switch (error.kind) {
    case "auth":
      // Sign in happens in the classic interface (another tab); the retry is for when the user comes back.
      return {
        id: "api.auth",
        severity: "error",
        title: translate("problems.auth.title"),
        cause: translate("problems.auth.cause"),
        action: { label: translate("problems.auth.action"), href: CLASSIC_INTERFACE_HREF },
        secondaryAction: { label: t("common.retry"), run: retry },
      };
    case "network":
      return {
        id: "api.network",
        severity: "error",
        title: translate("problems.network.title"),
        cause: translate("problems.network.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    case "http":
      return {
        id: "api.http",
        severity: "error",
        title: translate("problems.http.title"),
        cause: translate("problems.http.cause", { route: error.route, status: error.status ?? "?" }),
        action: { label: t("common.retry"), run: retry },
      };
    case "schema":
      return {
        id: `api.schema:${error.route}`,
        severity: "error",
        title: translate("problems.schema.title"),
        cause: translate("problems.schema.cause", { route: error.route, detail: error.message }),
        action: { label: t("common.retry"), run: retry },
      };
  }
}
