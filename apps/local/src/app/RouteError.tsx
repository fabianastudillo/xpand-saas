import { problemsStore } from "@xpand/ui";
import { useEffect, type ReactElement } from "react";
import { useRouteError } from "react-router";
import { useAppText } from "../i18n/messages";
import { IdeFrame } from "./IdeFrame";

const BASE_PATH = import.meta.env.BASE_URL;
const ROUTE_PROBLEM_ID = "route.error";

/**
 * The route's error element: a failed screen is reported in «Problemas» (with a way back to the catalog) inside the
 * shell, instead of React Router's default error page.
 */
export function RouteError(): ReactElement {
  const error = useRouteError();
  const translate = useAppText();
  const cause = error instanceof Error ? error.message : String(error);

  useEffect(() => {
    document.title = `${translate("problems.route.title")} · XPAND`;
  }, [translate]);

  useEffect(() => {
    problemsStore.add({
      id: ROUTE_PROBLEM_ID,
      severity: "error",
      title: translate("problems.route.title"),
      cause,
      action: { label: translate("actions.catalog"), href: BASE_PATH },
      source: "route",
    });
    return () => {
      problemsStore.remove(ROUTE_PROBLEM_ID);
    };
  }, [cause, translate]);

  return (
    <IdeFrame
      title="XPAND"
      path={[]}
      center={
        <p role="alert" className="p-4 text-sm text-error-ink">
          {translate("problems.route.cause")}
        </p>
      }
    />
  );
}
