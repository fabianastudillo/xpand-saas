"use client";

import type { Problem } from "@xpand/ui";
import { useMemo, type ReactElement } from "react";
import { usePublishedProblems } from "../../app/usePublishedProblems";
import { useAppText } from "../../i18n/messages";
import { CATALOG_PATH } from "../../lib/casePath";
import { CaseSummary } from "./CaseDocument";

/**
 * `/casos/<segmento>`: an address under the catalog that is not a case. It reads exactly as a case the server does not
 * have (spec §6.3): the same document with the way back to the catalog, and the same «Problemas» entry.
 */
export function StrayCasePage(): ReactElement {
  const translate = useAppText();
  const problems = useMemo<readonly Problem[]>(
    () => [
      {
        id: "route.notFound",
        severity: "error",
        title: translate("problems.notFound.title"),
        cause: translate("problems.notFound.cause"),
        action: { label: translate("actions.catalog"), href: CATALOG_PATH },
      },
    ],
    [translate],
  );
  usePublishedProblems(problems);
  return <CaseSummary red={undefined} failed={false} notFound />;
}
