import type { Catalogo } from "@xpand/api";
import { t } from "@xpand/ui";
import { countSystems } from "../features/explorar/catalog";
import type { Translate } from "../i18n/messages";

/** What the status bar needs of the catalog query. */
export interface CatalogState {
  data: Catalogo | undefined;
  isError: boolean;
}

/**
 * The status bar's live message about the catalog. It is a polite live region, so it has to be true at every
 * moment: loading, loaded with its count, or not available (the error itself is in «Problemas»). It must never say
 * «Cargando…» after the request failed.
 */
export function catalogStatusMessage(catalog: CatalogState, translate: Translate): string {
  if (catalog.data !== undefined) return translate("state.catalog", { n: countSystems(catalog.data) });
  if (catalog.isError) return translate("state.catalog.error");
  return t("common.loading");
}
