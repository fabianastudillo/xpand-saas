import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "../components/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { useShellLayout } from "./AppShell";
import { ProblemsList } from "./ProblemsList";
import type { Problem, ProblemTarget } from "./problems";
import { shortcutLabel } from "./shortcuts";

export type BottomTab = "problems" | "log" | "output";

export interface BottomPanelProps {
  problems: readonly Problem[];
  onNavigate?: (target: ProblemTarget) => void;
  /** Live log of the runs. */
  log?: ReactNode;
  output?: ReactNode;
  /** Controlled tab; uncontrolled (starting on Problems) when omitted. */
  tab?: BottomTab;
  onTabChange?: (tab: BottomTab) => void;
  className?: string;
}

const TABS: readonly BottomTab[] = ["problems", "log", "output"];

function isBottomTab(value: string): value is BottomTab {
  return (TABS as readonly string[]).includes(value);
}

/** Problems / Log / Output under the documents; the Problems tab carries the count. Collapses with Ctrl+J. */
export function BottomPanel({
  problems,
  onNavigate,
  log,
  output,
  tab,
  onTabChange,
  className,
}: BottomPanelProps): ReactElement {
  useLocale();
  const [ownTab, setOwnTab] = useState<BottomTab>("problems");
  const activeTab = tab ?? ownTab;
  const { bottom } = useShellLayout();

  const onValueChange = (value: string): void => {
    if (!isBottomTab(value)) return;
    if (tab === undefined) setOwnTab(value);
    onTabChange?.(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={onValueChange} className={cn("min-h-0 flex-1", className)}>
      <div className="flex shrink-0 items-center border-b border-line pr-1">
        <TabsList className="border-b-0">
          <TabsTrigger value="problems">
            {t("shell.panel.problems")}
            {problems.length > 0 ? (
              <span className="ml-1.5 rounded-sm bg-surface-sunken px-1 font-mono text-xs tabular-nums">
                {String(problems.length)}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="log">{t("shell.panel.log")}</TabsTrigger>
          <TabsTrigger value="output">{t("shell.panel.output")}</TabsTrigger>
        </TabsList>
        {bottom.id !== "" ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-label={t("shell.panel.collapse")}
            aria-keyshortcuts="Control+J Meta+J"
            title={`${t("shell.panel.collapse")} (${shortcutLabel("J")})`}
            onClick={bottom.toggle}
          >
            <span aria-hidden="true">▾</span>
          </Button>
        ) : null}
      </div>
      <TabsContent value="problems" className="min-h-0 flex-1 overflow-auto">
        <ProblemsList problems={problems} {...(onNavigate ? { onNavigate } : {})} />
      </TabsContent>
      <TabsContent value="log" className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
        {log}
      </TabsContent>
      <TabsContent value="output" className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
        {output}
      </TabsContent>
    </Tabs>
  );
}
