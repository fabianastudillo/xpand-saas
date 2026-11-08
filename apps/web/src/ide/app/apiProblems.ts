import type { ApiError } from "@xpand/api";
import { t, type Problem } from "@xpand/ui";
import { CATALOG_PATH } from "../lib/casePath";
import { CASE_NOT_FOUND_CODE } from "./caseErrors";
import type { Translate } from "../i18n/messages";

const PROBLEM_SOURCE = "api";

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
      return {
        id: "api.auth",
        severity: "error",
        title: translate("problems.auth.title"),
        cause: translate("problems.auth.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    case "network":
      return {
        id: "api.network",
        severity: "error",
        title: translate("problems.network.title"),
        cause: translate("problems.network.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    case "http": {
      const known = knownHttpProblem(error, retry, translate);
      if (known !== undefined) return known;
      return {
        id: "api.http",
        severity: "error",
        title: translate("problems.http.title"),
        cause: translate("problems.http.cause", { route: error.route, status: error.status ?? "?" }),
        action: { label: t("common.retry"), run: retry },
      };
    }
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

const STORE_UNAVAILABLE_CODE = "almacen_no_disponible";
const READER_FAILED_CODE = "lector_fallo";

/**
 * The server's own error codes (contract: `{ error: { codigo, mensaje } }`) say more than the status: a case that
 * does not exist is not retried, an unavailable store names where to look, an unreadable case says the rest of the
 * catalog is fine. The texts are the interface's, in the user's language; the server's message is not shown.
 */
function knownHttpProblem(error: ApiError, retry: () => void, translate: Translate): Problem | undefined {
  switch (error.code) {
    case CASE_NOT_FOUND_CODE:
      return {
        id: "api.notFound",
        severity: "error",
        title: translate("problems.notFound.title"),
        cause: translate("problems.notFound.cause"),
        action: { label: translate("actions.catalog"), href: CATALOG_PATH },
      };
    case STORE_UNAVAILABLE_CODE:
      return {
        id: "api.store",
        severity: "error",
        title: translate("problems.store.title"),
        cause: translate("problems.store.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    case READER_FAILED_CODE:
      return {
        id: "api.reader",
        severity: "error",
        title: translate("problems.reader.title"),
        cause: translate("problems.reader.cause"),
        action: { label: t("common.retry"), run: retry },
      };
    default:
      return undefined;
  }
}
