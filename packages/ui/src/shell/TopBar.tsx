import type { ReactElement, ReactNode } from "react";
import { Button } from "../components/Button";
import { Shortcut } from "../components/Kbd";
import { t, useLocale, type MessageKey } from "../i18n";
import { useShellLayout, type ShellLayout, type ZoneState } from "./shellLayoutContext";
import { shortcutAriaKeys, shortcutLabel } from "./shortcuts";

export interface TopBarProps {
  /** Breadcrumb of the open case: ["Garver 6", "GTEP"]. */
  path?: readonly string[];
  /** The one action bar with text buttons: «▶ Resolver», «Analizar ▾», «Exportar ▾»… */
  actions?: ReactNode;
  /** Shown as a «Buscar acción… Ctrl+K» button when given. */
  onOpenPalette?: () => void;
  /** Trailing slot: settings menu (language, theme). */
  children?: ReactNode;
}

interface ZoneToggle {
  zone: keyof Pick<ShellLayout, "left" | "right" | "bottom">;
  label: MessageKey;
  key: string;
}

const ZONE_TOGGLES: readonly ZoneToggle[] = [
  { zone: "left", label: "shell.toggle.left", key: "B" },
  { zone: "right", label: "shell.toggle.right", key: "I" },
  { zone: "bottom", label: "shell.toggle.bottom", key: "J" },
];

/**
 * Brand, case path, the action bar, persistent toggles for the collapsible zones (inside an AppShell) and
 * the command palette button, in one row that wraps on narrow screens.
 */
export function TopBar({ path = [], actions, onOpenPalette, children }: TopBarProps): ReactElement {
  useLocale();
  const layout = useShellLayout();
  return (
    <div data-slot="topbar" className="flex min-h-(--topbar-h) flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1">
      <span className="text-md font-semibold tracking-wide text-ink">XPAND</span>
      {path.length > 0 ? (
        // A labelled list, not a <nav>: the segments are plain text until M1 makes them links.
        <ol aria-label={t("shell.topbar.path")} className="m-0 flex min-w-0 list-none flex-wrap items-center gap-1 p-0 text-sm text-ink-muted">
          {path.map((segment, index) => (
            <li key={`${String(index)}-${segment}`} className="flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]">
              {index > 0 ? <span aria-hidden="true">›</span> : null}
              {segment}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
      {layout.attached ? (
        <div className="flex items-center gap-1">
          {ZONE_TOGGLES.map((toggle) => (
            <ZoneToggleButton key={toggle.zone} toggle={toggle} zone={layout[toggle.zone]} />
          ))}
        </div>
      ) : null}
      {onOpenPalette ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenPalette}
          aria-haspopup="dialog"
          aria-keyshortcuts={shortcutAriaKeys("K")}
          data-shell-palette-opener=""
        >
          <span className="text-ink-muted">{t("shell.topbar.palette")}</span>
          <Shortcut keys={shortcutLabel("K")} className="text-ink-muted" />
        </Button>
      ) : null}
      {children}
    </div>
  );
}

function ZoneToggleButton({ toggle, zone }: { toggle: ZoneToggle; zone: ZoneState }): ReactElement | null {
  if (!zone.present) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={zone.open}
      aria-controls={zone.id}
      aria-keyshortcuts={shortcutAriaKeys(toggle.key)}
      title={shortcutLabel(toggle.key)}
      onClick={zone.toggle}
      data-state={zone.open ? "open" : "closed"}
      // Open: ink plus a 2px inset accent rule under the text, so the state is not told by color alone.
      className={zone.open ? "text-ink shadow-[inset_0_-2px_0_var(--accent)]" : "text-ink-muted"}
    >
      {t(toggle.label)}
    </Button>
  );
}
