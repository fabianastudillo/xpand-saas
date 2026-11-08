import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "../components/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { ProblemsList } from "./ProblemsList";
import type { Problem, ProblemTarget } from "./problems";
import { useShellLayout, type BottomTab } from "./shellLayoutContext";
import { shortcutLabel } from "./shortcuts";

export type { BottomTab } from "./shellLayoutContext";

export interface BottomPanelProps {
  problems: readonly Problem[];
  onNavigate?: (target: ProblemTarget) => void;
  /** Live log of the runs; rendered in a `role="log"` region. */
  log?: ReactNode;
  output?: ReactNode;
  /**
   * Controlled tab. Uncontrolled when omitted: inside an AppShell the tab is shared through the layout (so
   * the status bar can select «Problemas»); outside it is local.
   */
  tab?: BottomTab;
  onTabChange?: (tab: BottomTab) => void;
  className?: string;
}

const TABS: readonly BottomTab[] = ["problems", "log", "output"];
const PANEL = "min-h-0 flex-1 overflow-auto";
const MONO_PANEL = "p-3 font-mono text-xs whitespace-pre-wrap";

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
  const layout = useShellLayout();
  const [localTab, setLocalTab] = useState<BottomTab>("problems");
  const activeTab = tab ?? (layout.attached ? layout.panelTab : localTab);

  const onValueChange = (value: string): void => {
    if (!isBottomTab(value)) return;
    if (tab === undefined) {
      if (layout.attached) layout.setPanelTab(value);
      else setLocalTab(value);
    }
    onTabChange?.(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={onValueChange} className={cn("min-h-0 flex-1", className)}>
      <div className="flex shrink-0 items-center border-b border-line pr-1">
        <TabsList className="border-b-0">
          <TabsTrigger value="problems">
            {t("shell.panel.problems")}
            {problems.length > 0 ? (
              <>
                <span aria-hidden="true" className="ml-1.5 rounded-sm bg-surface-sunken px-1 font-mono text-xs tabular-nums">
                  {String(problems.length)}
                </span>
                <span className="xp-sr-only">{t("shell.panel.problemsCount", { n: problems.length })}</span>
              </>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="log">{t("shell.panel.log")}</TabsTrigger>
          <TabsTrigger value="output">{t("shell.panel.output")}</TabsTrigger>
        </TabsList>
        {layout.attached && layout.bottom.present ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-label={t("shell.panel.collapse")}
            aria-keyshortcuts="Control+J Meta+J"
            title={`${t("shell.panel.collapse")} (${shortcutLabel("J")})`}
            onClick={layout.bottom.toggle}
          >
            <span aria-hidden="true">▾</span>
          </Button>
        ) : null}
      </div>
      <TabsContent value="problems" className={PANEL}>
        <h2 className="xp-sr-only">{t("shell.panel.problems")}</h2>
        <ProblemsList problems={problems} {...(onNavigate ? { onNavigate } : {})} />
      </TabsContent>
      <TabsContent value="log" className={PANEL}>
        <h2 className="xp-sr-only">{t("shell.panel.log")}</h2>
        <div role="log" className={MONO_PANEL}>
          {log}
        </div>
      </TabsContent>
      <TabsContent value="output" className={PANEL}>
        <h2 className="xp-sr-only">{t("shell.panel.output")}</h2>
        <div className={MONO_PANEL}>{output}</div>
      </TabsContent>
    </Tabs>
  );
}
