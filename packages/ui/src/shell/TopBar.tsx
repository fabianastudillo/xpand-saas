import type { ReactElement, ReactNode } from "react";
import { Button } from "../components/Button";
import { Shortcut } from "../components/Kbd";
import { t, useLocale } from "../i18n";
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

/** Brand, case path, the action bar and the command palette button, in one 40px row. */
export function TopBar({ path = [], actions, onOpenPalette, children }: TopBarProps): ReactElement {
  useLocale();
  return (
    <div data-slot="topbar" className="flex h-full items-center gap-3 px-3">
      <span className="text-md font-semibold tracking-wide text-ink">XPAND</span>
      {path.length > 0 ? (
        // A labelled list, not a <nav>: the segments are plain text until M1 makes them links.
        <ol aria-label={t("shell.topbar.path")} className="m-0 flex list-none items-center gap-1 p-0 text-sm text-ink-muted">
          {path.map((segment, index) => (
            <li key={`${String(index)}-${segment}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden="true">›</span> : null}
              {segment}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
      {onOpenPalette ? (
        <Button variant="ghost" size="sm" onClick={onOpenPalette} aria-keyshortcuts={shortcutAriaKeys("K")}>
          <span className="text-ink-muted">{t("shell.topbar.palette")}</span>
          <Shortcut keys={shortcutLabel("K")} className="text-ink-muted" />
        </Button>
      ) : null}
      {children}
    </div>
  );
}
