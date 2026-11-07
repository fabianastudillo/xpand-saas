import { useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "../components/Button";
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
/** Drawers sit inside the body row, under the top bar, so its toggles stay visible and clickable. */
const DRAWER = "absolute inset-y-0 z-30 w-[min(20rem,85vw)] shadow-pop";

/**
 * The IDE frame: top bar, case explorer (left), documents (center), inspector (right), bottom panel and
 * status bar. Left, right and bottom collapse (Ctrl+B, Ctrl+I, Ctrl+J; ⌘ on macOS) and remember it in
 * localStorage. Collapsed zones stay mounted (`hidden` + `inert`) so their state survives; the focus is
 * moved out and back (see useShellZone). Below the breakpoint the side zones are drawers over an overlay:
 * while one is open the rest of the shell (except the top bar) is inert; Escape, the overlay and a close
 * button dismiss it. Each zone is a landmark: banner, complementary ×2, main, region, contentinfo.
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
  const drawerOpen = narrow && (leftZone.state.open || rightZone.state.open);

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
  const closeDrawers = (): void => {
    leftZone.state.setOpen(false);
    rightZone.state.setOpen(false);
  };
  useDrawerEscape(drawerOpen, closeDrawers);
  const needsTab = useZonesNeedTab(leftZone, rightZone, bottomZone);

  return (
    <ShellLayoutContext.Provider value={layout}>
      <div
        data-slot="app-shell"
        data-narrow={narrow}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto_auto] bg-surface text-ink",
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
          {drawerOpen ? (
            <div
              data-slot="shell-overlay"
              aria-hidden="true"
              className="absolute inset-0 z-20 bg-ink/20"
              // Keep the focus inside the drawer through the mousedown, so closing can return it to the opener.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={closeDrawers}
            />
          ) : null}
          <Zone
            as="aside"
            handle={leftZone}
            label={t("shell.zone.left")}
            closeLabel={t("shell.drawer.close.left")}
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
            inert={drawerOpen}
            data-slot="shell-center"
            className="flex min-w-0 flex-1 flex-col overflow-hidden outline-none"
          >
            {center}
          </main>
          <Zone
            as="aside"
            handle={rightZone}
            label={t("shell.zone.right")}
            closeLabel={t("shell.drawer.close.right")}
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
          suspended={drawerOpen}
          slot="shell-bottom"
          className={cn("h-56 overflow-hidden border-t border-line", narrow && "max-h-[40dvh]")}
        >
          {bottom}
        </Zone>
        {status !== undefined ? (
          <footer
            data-slot="shell-status"
            inert={drawerOpen}
            className="h-(--statusbar-h) border-t border-line bg-surface-sunken"
          >
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
  /** Text of the close button shown at the foot of the zone while it is a drawer. */
  closeLabel?: string;
  needsTab: boolean;
  /** Inert although visible (a drawer is open over it). */
  suspended?: boolean;
  slot: string;
  className: string;
  children: ReactNode;
}

/** A collapsible landmark. Hidden zones keep their DOM (`hidden` + `inert`), so `aria-controls` always resolves. */
function Zone({ as: Tag, handle, label, closeLabel, needsTab, suspended = false, slot, className, children }: ZoneProps): ReactElement | null {
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
      inert={!open || suspended}
      tabIndex={needsTab ? 0 : -1}
      className={cn(ZONE_BASE, className)}
    >
      {children}
      {handle.drawer && closeLabel !== undefined ? (
        // Last in the DOM on purpose: opening the drawer focuses its content first, not this button.
        <div className="mt-auto shrink-0 border-t border-line p-2">
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              handle.state.setOpen(false);
            }}
          >
            {closeLabel}
          </Button>
        </div>
      ) : null}
    </Tag>
  );
}

/** Escape closes the open drawers, unless a dialog already consumed the key. */
function useDrawerEscape(drawerOpen: boolean, closeDrawers: () => void): void {
  const latest = useRef({ drawerOpen, closeDrawers });
  latest.current = { drawerOpen, closeDrawers };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented || !latest.current.drawerOpen) return;
      latest.current.closeDrawers();
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
    // The handles are new objects on every render, so this runs after each render, as the content may have changed.
  }, [left, right, bottom]);
  return needsTab;
}
