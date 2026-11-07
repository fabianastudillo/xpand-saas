import type { Catalogo } from "@xpand/api";
import type { Problem } from "@xpand/ui";
import { countSystems } from "../features/explorar/catalog";
import type { Translate } from "../i18n/messages";
import { textOf } from "../lib/values";

const CATALOG_SOURCE = "catalogo";

/**
 * The «Problemas» entries that a loaded catalog carries by itself: an empty one (how to fill the store) and the
 * server's public notice (shown as the interface's own localized message, not the server's Spanish text).
 */
export function catalogProblems(catalog: Catalogo | undefined, translate: Translate): Problem[] {
  if (catalog === undefined) return [];
  const problems: Problem[] = [];
  if (countSystems(catalog) === 0) {
    problems.push({
      id: "catalog.empty",
      severity: "warn",
      title: translate("problems.catalogEmpty.title"),
      cause: translate("problems.catalogEmpty.cause"),
      source: CATALOG_SOURCE,
    });
  }
  // The server's notice is Spanish prose: whenever there is one, the interface says its own (localized) version.
  const notice = textOf(catalog["aviso"]);
  if (notice !== undefined && notice !== "") {
    problems.push({
      id: "catalog.notice",
      severity: "warn",
      title: translate("problems.catalogNotice.title"),
      cause: translate("problems.catalogNotice.cause"),
      source: CATALOG_SOURCE,
    });
  }
  return problems;
}
