import { useOutletContext } from "react-router";
import type { ReactElement } from "react";
import type { LayoutOutlet } from "../../app/AppLayout";
import { CaseSummary } from "./CaseDocument";

/** The case's document: the summary of the network, inside the layout's document area. */
export function CasePage(): ReactElement {
  const { red } = useOutletContext<LayoutOutlet>();
  return <CaseSummary red={red.data} failed={red.isError} />;
}
