import type { ReactElement, ReactNode } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { useShellLayout } from "./AppShell";
import { countBySeverity, type Problem } from "./problems";

export interface StatusBarProps {
  /** Short, truthful state: «Catálogo cargado», «Resolviendo… 12 s». Announced politely. */
  message?: ReactNode;
  /** When given, a summary («1 error, 2 avisos») that opens the bottom panel. */
  problems?: readonly Problem[];
  /** Right side: language, density… */
  children?: ReactNode;
  className?: string;
}

function problemsSummary(problems: readonly Problem[]): string {
  const counts = countBySeverity(problems);
  const parts = [
    counts.error === 1 ? t("shell.status.error.one") : counts.error > 1 ? t("shell.status.error.many", { n: counts.error }) : null,
    counts.warn === 1 ? t("shell.status.warn.one") : counts.warn > 1 ? t("shell.status.warn.many", { n: counts.warn }) : null,
    counts.info === 1 ? t("shell.status.info.one") : counts.info > 1 ? t("shell.status.info.many", { n: counts.info }) : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? t("shell.problems.empty") : parts.join(", ");
}

/** One 28px row: the live message on the left, the problems summary, and the trailing slot on the right. */
export function StatusBar({ message, problems, children, className }: StatusBarProps): ReactElement {
  useLocale();
  const { bottom } = useShellLayout();
  const summary = problems === undefined ? null : problemsSummary(problems);
  const hasProblems = problems !== undefined && problems.length > 0;
  return (
    <div data-slot="statusbar" className={cn("flex h-full items-center gap-3 px-3 text-sm", className)}>
      <p role="status" aria-live="polite" className="m-0 min-w-0 flex-1 truncate text-ink-muted">
        {message}
      </p>
      {summary === null ? null : hasProblems ? (
        <button
          type="button"
          className={cn(
            "rounded-sm px-1 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent",
            problems.some((problem) => problem.severity === "error") ? "text-error-ink" : "text-warn-ink",
          )}
          aria-controls={bottom.id || undefined}
          aria-expanded={bottom.open}
          onClick={() => {
            bottom.setOpen(true);
          }}
        >
          {summary}
        </button>
      ) : (
        <span className="text-ink-muted">{summary}</span>
      )}
      {children}
    </div>
  );
}
