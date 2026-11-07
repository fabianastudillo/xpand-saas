import { useEffect, useState, type ReactElement } from "react";
import { t, useLocale } from "../i18n";
import { problemsStore, type Problem, type ProblemsStore } from "./problems";

export interface ProblemsAnnouncerProps {
  store?: ProblemsStore;
}

/** New errors within this window are announced as one message. */
const BATCH_MS = 300;

function announcement(batch: readonly Problem[]): string {
  const [first] = batch;
  if (batch.length === 1 && first) return t("shell.announce.error", { title: first.title });
  return t("shell.announce.errors", { n: batch.length });
}

/**
 * An always-mounted, visually hidden polite live region that announces errors added to the store after it
 * mounted (what was there on the initial load is not read out). Warnings and information stay silent: they
 * are visible in the panel and counted in the status bar. Replacing an existing id is not an addition.
 */
export function ProblemsAnnouncer({ store = problemsStore }: ProblemsAnnouncerProps): ReactElement {
  useLocale();
  const [message, setMessage] = useState("");

  useEffect(() => {
    let known = new Set(store.getList().map((problem) => problem.id));
    let pending: readonly Problem[] = [];
    let timer: number | undefined;

    const unsubscribe = store.subscribe(() => {
      const list = store.getList();
      const fresh = list.filter((problem) => problem.severity === "error" && !known.has(problem.id));
      known = new Set(list.map((problem) => problem.id));
      if (fresh.length === 0) return;
      pending = [...pending, ...fresh];
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const batch = pending;
        pending = [];
        setMessage(announcement(batch));
      }, BATCH_MS);
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [store]);

  return (
    <div data-slot="problems-announcer" role="status" aria-live="polite" aria-atomic="true" className="xp-sr-only">
      {message}
    </div>
  );
}
