import { useEffect, useId, useRef, type ReactElement } from "react";
import { Button } from "../components/Button";
import { t, useLocale, type MessageKey } from "../i18n";
import { cn } from "../lib/cn";
import { SEVERITIES, type Problem, type ProblemSeverity, type ProblemTarget } from "./problems";

export interface ProblemsListProps {
  problems: readonly Problem[];
  /** Called with the target of a problem when «Ir a …» is activated. Without it the link is not shown. */
  onNavigate?: (target: ProblemTarget) => void;
  className?: string;
}

interface SeverityStyle {
  glyph: string;
  heading: MessageKey;
  label: MessageKey;
  className: string;
}

/** Severity is said in text and drawn with a glyph; color is the third channel, never the only one. */
const SEVERITY: Readonly<Record<ProblemSeverity, SeverityStyle>> = {
  error: { glyph: "✕", heading: "shell.problems.heading.error", label: "shell.problems.severity.error", className: "text-error-ink" },
  warn: { glyph: "▲", heading: "shell.problems.heading.warn", label: "shell.problems.severity.warn", className: "text-warn-ink" },
  info: { glyph: "ⓘ", heading: "shell.problems.heading.info", label: "shell.problems.severity.info", className: "text-ink-muted" },
};

const TARGET_KIND: Readonly<Record<ProblemTarget["kind"], MessageKey>> = {
  bus: "shell.problems.kind.bus",
  line: "shell.problems.kind.line",
  candidate: "shell.problems.kind.candidate",
  route: "shell.problems.kind.route",
};

/** Problems in display order: by severity (errors first), then as given. */
function ordered(problems: readonly Problem[]): readonly Problem[] {
  return SEVERITIES.flatMap((severity) => problems.filter((problem) => problem.severity === severity));
}

interface Activated {
  id: string;
  index: number;
}

/**
 * Problems grouped by severity (errors first), each with its cause, its action and a link to its element.
 * When an action makes its own problem disappear, the focus moves to the next problem's first button, or to
 * the list itself (or the empty message) when none is left.
 */
export function ProblemsList({ problems, onNavigate, className }: ProblemsListProps): ReactElement {
  useLocale();
  const baseId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const activated = useRef<Activated | null>(null);
  const shown = ordered(problems);

  useEffect(() => {
    const last = activated.current;
    if (!last || shown.some((problem) => problem.id === last.id)) return;
    activated.current = null; // one move per activation, whether or not it happens
    const root = rootRef.current;
    if (!root) return;
    // Only when the focus is lost (the button went away) or still here: a user who moved on keeps their place.
    const active = document.activeElement;
    if (active !== null && active !== document.body && !root.contains(active)) return;
    const items = root.querySelectorAll<HTMLElement>("li");
    const next = items[Math.min(last.index, items.length - 1)];
    (next?.querySelector<HTMLElement>("button") ?? root).focus();
  }, [shown]);

  if (problems.length === 0) {
    return (
      <p
        ref={(element) => {
          rootRef.current = element;
        }}
        tabIndex={-1}
        className={cn("px-3 py-2 text-sm text-ink-muted outline-none", className)}
      >
        {t("shell.problems.empty")}
      </p>
    );
  }

  const sections = SEVERITIES.map((severity) => ({
    severity,
    problems: problems.filter((problem) => problem.severity === severity),
  })).filter((section) => section.problems.length > 0);

  return (
    <div
      ref={(element) => {
        rootRef.current = element;
      }}
      data-slot="problems-list"
      role="group"
      aria-label={t("shell.problems.listLabel")}
      tabIndex={-1}
      className={cn("flex flex-col gap-3 p-3 outline-none", className)}
    >
      {sections.map(({ severity, problems: list }) => (
        <section key={severity} className="flex flex-col gap-1">
          <h3 className={cn("xp-label", SEVERITY[severity].className)}>{t(SEVERITY[severity].heading, { n: list.length })}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {list.map((problem) => (
              <ProblemItem
                key={problem.id}
                problem={problem}
                titleId={`${baseId}-t${String(shown.indexOf(problem))}`}
                onNavigate={onNavigate}
                onActivate={() => {
                  activated.current = { id: problem.id, index: shown.indexOf(problem) };
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface ProblemItemProps {
  problem: Problem;
  titleId: string;
  onNavigate: ((target: ProblemTarget) => void) | undefined;
  onActivate: () => void;
}

function ProblemItem({ problem, titleId, onNavigate, onActivate }: ProblemItemProps): ReactElement {
  const style = SEVERITY[problem.severity];
  const target = problem.target;
  const action = problem.action;
  return (
    <li className="flex items-start gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
      <span aria-hidden="true" className={cn("w-4 shrink-0 text-center", style.className)}>
        {style.glyph}
      </span>
      <span className="xp-sr-only">{t(style.label)}:</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={titleId} className="font-medium text-ink">
          {problem.title}
        </span>
        {problem.cause !== undefined ? <span className="text-ink-muted">{problem.cause}</span> : null}
      </div>
      {action ? (
        <Button
          size="sm"
          aria-describedby={titleId}
          onClick={() => {
            onActivate();
            action.run();
          }}
        >
          {action.label}
        </Button>
      ) : null}
      {target && onNavigate ? (
        <Button
          size="sm"
          variant="ghost"
          aria-describedby={titleId}
          onClick={() => {
            onActivate();
            onNavigate(target);
          }}
        >
          {t("shell.problems.goTo", { kind: t(TARGET_KIND[target.kind]), id: target.id })}
        </Button>
      ) : null}
    </li>
  );
}
