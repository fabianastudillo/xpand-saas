"use client";

import type { ReactElement } from "react";
import { isCaseNotFound } from "../../app/caseErrors";
import { useCaseContext } from "../../app/ideContext";
import { CaseSummary } from "./CaseDocument";

/** The case's document: the summary of the network, inside the layout's document area. */
export function CasePage(): ReactElement {
  const { red } = useCaseContext();
  return <CaseSummary red={red.data} failed={red.isError} notFound={isCaseNotFound(red.error)} />;
}
