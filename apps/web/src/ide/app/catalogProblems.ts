import type { Catalogo } from "@xpand/api";
import type { Problem } from "@xpand/ui";
import { countSystems } from "../features/explorar/catalog";
import type { AppMessageKey, Translate } from "../i18n/messages";
import { textOf } from "../lib/values";

const CATALOG_SOURCE = "catalogo";

/** The interface's text for each stable code of the server's notice (`codigo_aviso`). */
const NOTICE_CAUSE_KEYS = {
  relectura: "problems.catalogNotice.relectura",
  descartados: "problems.catalogNotice.descartados",
} as const;

function noticeCauseKey(code: unknown): AppMessageKey {
  return code === "relectura" || code === "descartados" ? NOTICE_CAUSE_KEYS[code] : "problems.catalogNotice.cause";
}

/**
 * The «Problemas» entries that a loaded catalog carries by itself: an empty one (how to fill the store) or, for a
 * catalog with systems, the server's public notice. The notice is said in the interface's own words, chosen by its
 * stable code (`codigo_aviso`), never the server's Spanish prose; a code it does not know gets the generic text. An
 * empty catalog says only that it is empty: its entry already tells what to do, and «some cases failed» next to it
 * would not be true (the store is just missing or empty).
 */
export function catalogProblems(catalog: Catalogo | undefined, translate: Translate): Problem[] {
  if (catalog === undefined) return [];
  if (countSystems(catalog) === 0) {
    return [
      {
        id: "catalog.empty",
        severity: "warn",
        title: translate("problems.catalogEmpty.title"),
        cause: translate("problems.catalogEmpty.cause"),
        source: CATALOG_SOURCE,
      },
    ];
  }
  const notice = textOf(catalog["aviso"]);
  if (notice === undefined || notice === "") return [];
  return [
    {
      id: "catalog.notice",
      severity: "warn",
      title: translate("problems.catalogNotice.title"),
      cause: translate(noticeCauseKey(catalog["codigo_aviso"])),
      source: CATALOG_SOURCE,
    },
  ];
}
