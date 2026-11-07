import { ApiFailure } from "@xpand/api";

/** The server's code for a case that is not in the catalog (also for one that is not published: no oracle). */
export const CASE_NOT_FOUND_CODE = "caso_no_encontrado";

/** True when the failure is the server saying «there is no such case»: retrying will not change it. */
export function isCaseNotFound(error: unknown): boolean {
  return error instanceof ApiFailure && error.error.code === CASE_NOT_FOUND_CODE;
}
