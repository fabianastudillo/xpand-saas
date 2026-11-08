import type { ReactElement, ReactNode } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { countBySeverity, type Problem } from "./problems";
import { useShellLayout } from "./shellLayoutContext";

export interface StatusBarProps {
  /**
   * Short, truthful state: «Catálogo cargado», «Resolviendo…». It lives in a polite live region, so every
   * change is announced: put only state changes here, never a ticking timer (that goes in `progress`).
   */
  message?: ReactNode;
  /** Timers, counters, percentages: shown next to the message but hidden from assistive technology. */
  progress?: ReactNode;
  /** When given, a summary («1 error, 2 avisos» or «Sin problemas») that toggles the Problems panel. */
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

function summaryTone(problems: readonly Problem[]): string {
  if (problems.some((problem) => problem.severity === "error")) return "text-error-ink";
  if (problems.some((problem) => problem.severity === "warn")) return "text-warn-ink";
  return "text-ink-muted";
}

/** One 28px row: the live message on the left, the problems toggle, and the trailing slot on the right. */
export function StatusBar({ message, progress, problems, children, className }: StatusBarProps): ReactElement {
  useLocale();
  const { bottom, panelTab, setPanelTab } = useShellLayout();

  // Closed → open on Problems; open on another tab → select Problems; open on Problems → close.
  const toggleProblems = (): void => {
    if (!bottom.open) {
      setPanelTab("problems");
      bottom.setOpen(true);
    } else if (panelTab !== "problems") {
      setPanelTab("problems");
    } else {
      bottom.setOpen(false);
    }
  };

  return (
    <div data-slot="statusbar" className={cn("flex h-full items-center gap-3 px-3 text-sm", className)}>
      <p role="status" aria-live="polite" className="m-0 min-w-0 truncate text-ink-muted">
        {message}
      </p>
      {progress !== undefined ? (
        <span aria-hidden="true" className="font-mono text-ink-muted tabular-nums">
          {progress}
        </span>
      ) : null}
      <span className="flex-1" />
      {problems !== undefined ? (
        <button
          type="button"
          className={cn(
            "rounded-sm px-1 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent",
            summaryTone(problems),
          )}
          aria-controls={bottom.id || undefined}
          aria-expanded={bottom.open && panelTab === "problems"}
          onClick={toggleProblems}
        >
          {problemsSummary(problems)}
        </button>
      ) : null}
      {children}
    </div>
  );
}
