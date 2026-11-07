import { createContext, useContext, useId, useMemo, type ReactElement, type ReactNode } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { useZoneOpen, type ShellZone } from "./layoutStore";
import { useShortcuts } from "./shortcuts";

export interface ZoneState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  /** DOM id of the zone, for aria-controls on a toggle. */
  id: string;
}

export interface ShellLayout {
  left: ZoneState;
  right: ZoneState;
  bottom: ZoneState;
}

const noop = (): void => {};
const DETACHED_ZONE: ZoneState = { open: true, toggle: noop, setOpen: noop, id: "" };

// Outside an AppShell every zone reads as open and the toggles do nothing, so parts render standalone.
const ShellLayoutContext = createContext<ShellLayout>({
  left: DETACHED_ZONE,
  right: DETACHED_ZONE,
  bottom: DETACHED_ZONE,
});

/** Open/collapsed state of the three collapsible zones, with their toggles. */
export function useShellLayout(): ShellLayout {
  return useContext(ShellLayoutContext);
}

export interface AppShellProps {
  top?: ReactNode;
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  status?: ReactNode;
  className?: string;
}

const DEFAULT_OPEN: Readonly<Record<ShellZone, boolean>> = { left: true, right: true, bottom: true };

function useZone(zone: ShellZone, id: string): ZoneState {
  const [open, setOpen] = useZoneOpen(zone, DEFAULT_OPEN[zone]);
  return useMemo(() => ({ open, setOpen, toggle: () => { setOpen(!open); }, id }), [open, setOpen, id]);
}

/**
 * The IDE frame: top bar, case explorer (left), documents (center), inspector (right), bottom panel and
 * status bar. Left, right and bottom collapse (Ctrl+B, Ctrl+I, Ctrl+J; ⌘ on macOS) and remember it in
 * localStorage. Each zone is a landmark: banner, complementary ×2, main, region, contentinfo.
 * Shortcuts are left to the text field while typing; see shortcuts.ts for the browser conflicts.
 */
export function AppShell({ top, left, center, right, bottom, status, className }: AppShellProps): ReactElement {
  useLocale();
  const baseId = useId();
  const leftZone = useZone("left", `${baseId}-left`);
  const rightZone = useZone("right", `${baseId}-right`);
  const bottomZone = useZone("bottom", `${baseId}-bottom`);
  const layout = useMemo<ShellLayout>(
    () => ({ left: leftZone, right: rightZone, bottom: bottomZone }),
    [leftZone, rightZone, bottomZone],
  );

  useShortcuts([
    { key: "b", run: leftZone.toggle },
    { key: "j", run: bottomZone.toggle },
    { key: "i", run: rightZone.toggle },
  ]);

  return (
    <ShellLayoutContext.Provider value={layout}>
      <div
        data-slot="app-shell"
        className={cn("grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto_auto] bg-surface text-ink", className)}
      >
        {top !== undefined ? (
          <header data-slot="shell-top" className="h-(--topbar-h) border-b border-line bg-surface-raised">
            {top}
          </header>
        ) : (
          <div />
        )}
        <div className="flex min-h-0">
          {left !== undefined && leftZone.open ? (
            <aside
              id={leftZone.id}
              data-slot="shell-left"
              aria-label={t("shell.zone.left")}
              className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-line bg-surface-raised"
            >
              {left}
            </aside>
          ) : null}
          <main data-slot="shell-center" className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {center}
          </main>
          {right !== undefined && rightZone.open ? (
            <aside
              id={rightZone.id}
              data-slot="shell-right"
              aria-label={t("shell.zone.right")}
              className="flex w-72 shrink-0 flex-col overflow-auto border-l border-line bg-surface-raised"
            >
              {right}
            </aside>
          ) : null}
        </div>
        {bottom !== undefined && bottomZone.open ? (
          <section
            id={bottomZone.id}
            data-slot="shell-bottom"
            aria-label={t("shell.zone.bottom")}
            className="flex h-56 flex-col overflow-hidden border-t border-line bg-surface-raised"
          >
            {bottom}
          </section>
        ) : (
          <div />
        )}
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
