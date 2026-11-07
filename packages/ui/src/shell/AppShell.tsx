import { useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { hasFocusable } from "./focusable";
import { ProblemsAnnouncer } from "./ProblemsAnnouncer";
import { problemsStore, type ProblemsStore } from "./problems";
import { ShellLayoutContext, type BottomTab, type ShellLayout } from "./shellLayoutContext";
import { useShortcuts } from "./shortcuts";
import { useMediaQuery } from "./useMediaQuery";
import { useShellZone, type ShellZoneHandle } from "./useShellZone";

export { useShellLayout } from "./shellLayoutContext";

export interface AppShellProps {
  top?: ReactNode;
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  status?: ReactNode;
  /** Visually hidden h1 (case or app name) so the h2/h3 of the zones hang from it. Default «XPAND». */
  title?: string;
  /** Store watched by the live announcer of new errors. Default: the application store. */
  problemsStore?: ProblemsStore;
  className?: string;
}

/** Below this width (768px at 16px) the side zones become drawers and the page may scroll. */
export const NARROW_QUERY = "(max-width: 47.9375rem)";

const ZONE_BASE =
  "flex shrink-0 flex-col bg-surface-raised outline-none " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const DRAWER = "fixed inset-y-0 z-30 w-[min(20rem,85vw)] shadow-pop";

/**
 * The IDE frame: top bar, case explorer (left), documents (center), inspector (right), bottom panel and
 * status bar. Left, right and bottom collapse (Ctrl+B, Ctrl+I, Ctrl+J; ⌘ on macOS) and remember it in
 * localStorage. Collapsed zones stay mounted (`hidden` + `inert`) so their state survives; the focus is
 * moved out and back (see useShellZone). Each zone is a landmark: banner, complementary ×2, main, region,
 * contentinfo. Shortcuts are left to text fields and to open modal dialogs; see shortcuts.ts.
 */
export function AppShell({
  top,
  left,
  center,
  right,
  bottom,
  status,
  title,
  problemsStore: store = problemsStore,
  className,
}: AppShellProps): ReactElement {
  useLocale();
  const baseId = useId();
  const mainId = `${baseId}-main`;
  const mainRef = useRef<HTMLElement | null>(null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const leftZone = useShellZone({ zone: "left", id: `${baseId}-left`, present: left !== undefined, narrow, mainRef });
  const rightZone = useShellZone({ zone: "right", id: `${baseId}-right`, present: right !== undefined, narrow, mainRef });
  const bottomZone = useShellZone({ zone: "bottom", id: `${baseId}-bottom`, present: bottom !== undefined, narrow, mainRef });
  const [panelTab, setPanelTab] = useState<BottomTab>("problems");

  const layout = useMemo<ShellLayout>(
    () => ({
      attached: true,
      narrow,
      left: leftZone.state,
      right: rightZone.state,
      bottom: bottomZone.state,
      panelTab,
      setPanelTab,
    }),
    [narrow, leftZone.state, rightZone.state, bottomZone.state, panelTab],
  );

  useShortcuts([
    { key: "b", run: leftZone.state.toggle },
    { key: "j", run: bottomZone.state.toggle },
    { key: "i", run: rightZone.state.toggle },
  ]);
  useDrawerEscape(narrow, leftZone, rightZone);
  const needsTab = useZonesNeedTab(leftZone, rightZone, bottomZone);

  return (
    <ShellLayoutContext.Provider value={layout}>
      <div
        data-slot="app-shell"
        data-narrow={narrow}
        className={cn(
          "grid grid-rows-[auto_minmax(0,1fr)_auto_auto] bg-surface text-ink",
          narrow ? "min-h-dvh" : "h-dvh",
          className,
        )}
      >
        <a
          href={`#${mainId}`}
          className="xp-skip-link"
          onClick={(event) => {
            event.preventDefault();
            mainRef.current?.focus();
          }}
        >
          {t("shell.skip")}
        </a>
        <h1 className="xp-sr-only">{title ?? "XPAND"}</h1>
        <ProblemsAnnouncer store={store} />
        {top !== undefined ? (
          <header data-slot="shell-top" className="min-h-(--topbar-h) border-b border-line bg-surface-raised">
            {top}
          </header>
        ) : (
          <div />
        )}
        <div className="relative flex min-h-0">
          <Zone
            as="aside"
            handle={leftZone}
            label={t("shell.zone.left")}
            needsTab={needsTab.left}
            slot="shell-left"
            className={cn("w-64 overflow-hidden border-r border-line", leftZone.drawer && cn(DRAWER, "left-0"))}
          >
            {left}
          </Zone>
          <main
            id={mainId}
            ref={mainRef}
            tabIndex={-1}
            data-slot="shell-center"
            className="flex min-w-0 flex-1 flex-col overflow-hidden outline-none"
          >
            {center}
          </main>
          <Zone
            as="aside"
            handle={rightZone}
            label={t("shell.zone.right")}
            needsTab={needsTab.right}
            slot="shell-right"
            className={cn("w-72 overflow-auto border-l border-line", rightZone.drawer && cn(DRAWER, "right-0"))}
          >
            {right}
          </Zone>
        </div>
        <Zone
          as="section"
          handle={bottomZone}
          label={t("shell.zone.bottom")}
          needsTab={needsTab.bottom}
          slot="shell-bottom"
          className={cn("h-56 overflow-hidden border-t border-line", narrow && "max-h-[40dvh]")}
        >
          {bottom}
        </Zone>
        {status !== undefined ? (
          <footer data-slot="shell-status" className="h-(--statusbar-h) border-t border-line bg-surface-sunken">
            {status}
          </footer>
        ) : (
          <div />
        )}
      </div>
    </ShellLayoutContext.Provider>
  );
}

interface ZoneProps {
  as: "aside" | "section";
  handle: ShellZoneHandle;
  label: string;
  needsTab: boolean;
  slot: string;
  className: string;
  children: ReactNode;
}

/** A collapsible landmark. Hidden zones keep their DOM (`hidden` + `inert`), so `aria-controls` always resolves. */
function Zone({ as: Tag, handle, label, needsTab, slot, className, children }: ZoneProps): ReactElement | null {
  if (!handle.state.present) return null;
  const open = handle.state.open;
  return (
    <Tag
      id={handle.state.id}
      ref={handle.ref}
      data-slot={slot}
      data-mode={handle.drawer ? "drawer" : "dock"}
      aria-label={label}
      hidden={!open}
      inert={!open}
      tabIndex={needsTab ? 0 : -1}
      className={cn(ZONE_BASE, className)}
    >
      {children}
    </Tag>
  );
}

/** Escape closes an open drawer (narrow layout only), unless a dialog already consumed the key. */
function useDrawerEscape(narrow: boolean, left: ShellZoneHandle, right: ShellZoneHandle): void {
  const latest = useRef({ narrow, left, right });
  latest.current = { narrow, left, right };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const current = latest.current;
      if (!current.narrow || event.key !== "Escape" || event.defaultPrevented) return;
      if (current.left.state.open) current.left.state.setOpen(false);
      if (current.right.state.open) current.right.state.setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

type NeedsTab = Record<"left" | "right" | "bottom", boolean>;

function zoneNeedsTab(handle: ShellZoneHandle): boolean {
  const element = handle.ref.current;
  return element !== null && !hasFocusable(element);
}

/** A scrollable zone with nothing focusable inside becomes a tab stop itself (WCAG 2.1.1). */
function useZonesNeedTab(left: ShellZoneHandle, right: ShellZoneHandle, bottom: ShellZoneHandle): NeedsTab {
  const [needsTab, setNeedsTab] = useState<NeedsTab>({ left: false, right: false, bottom: false });
  useEffect(() => {
    const next: NeedsTab = { left: zoneNeedsTab(left), right: zoneNeedsTab(right), bottom: zoneNeedsTab(bottom) };
    setNeedsTab((current) =>
      current.left === next.left && current.right === next.right && current.bottom === next.bottom ? current : next,
    );
  });
  return needsTab;
}
