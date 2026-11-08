import { problemsStore } from "@xpand/ui";
import { useEffect, type ReactElement } from "react";
import { useAppText } from "../i18n/messages";
import { CATALOG_PATH } from "../lib/casePath";

const ROUTE_PROBLEM_ID = "route.error";

/**
 * The error boundary of a page of the zone: a screen that failed is reported in «Problemas» (with a way back to the
 * catalog), inside the frame that keeps standing around it, instead of Next's default error page.
 */
export function RouteError({ error }: { error: Error }): ReactElement {
  const translate = useAppText();
  const cause = error.message;

  useEffect(() => {
    document.title = `${translate("problems.route.title")} · XPAND`;
  }, [translate]);

  useEffect(() => {
    problemsStore.add({
      id: ROUTE_PROBLEM_ID,
      severity: "error",
      title: translate("problems.route.title"),
      cause,
      action: { label: translate("actions.catalog"), href: CATALOG_PATH },
      source: "route",
    });
    return () => {
      problemsStore.remove(ROUTE_PROBLEM_ID);
    };
  }, [cause, translate]);

  return (
    <p role="alert" className="p-4 text-sm text-error-ink">
      {translate("problems.route.cause")}
    </p>
  );
}
