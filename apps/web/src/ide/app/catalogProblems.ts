import type { Catalogo } from "@xpand/api";
import type { Problem } from "@xpand/ui";
import { countSystems } from "../features/explorar/catalog";
import type { Translate } from "../i18n/messages";
import { textOf } from "../lib/values";

const CATALOG_SOURCE = "catalogo";

/**
 * The «Problemas» entries that a loaded catalog carries by itself: an empty one (how to fill the store) and the
 * server's public notice («Algunos casos no se pudieron cargar.»), shown in the server's own words.
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
  const notice = textOf(catalog["aviso"]);
  if (notice !== undefined && notice !== "") {
    problems.push({
      id: "catalog.notice",
      severity: "warn",
      title: translate("problems.catalogNotice.title"),
      cause: notice,
      source: CATALOG_SOURCE,
    });
  }
  return problems;
}
