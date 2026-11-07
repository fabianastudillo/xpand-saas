import { useCatalogo, useConfig, useSesion } from "@xpand/api";
import {
  AppShell,
  BottomPanel,
  CommandPalette,
  StatusBar,
  TopBar,
  useProblems,
  useShellCommands,
  type Command,
} from "@xpand/ui";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAppText } from "../i18n/messages";
import { catalogStatusMessage } from "./catalogStatus";
import { UI_VERSION, versionMessage } from "./uiVersion";
import { LocaleSwitch } from "./LocaleSwitch";
import { useApiProblems } from "./useApiProblems";

export interface IdeFrameProps {
  /** Name of the page: the visually hidden h1 of the shell. */
  title: string;
  /** Breadcrumb in the top bar: ["Garver 6 — benchmark…", "Garver 6"]. */
  path: readonly string[];
  left?: ReactNode;
  right?: ReactNode;
  center: ReactNode;
  /** Query errors of the route; the shell reports the catalog, session and version ones. Memoize the list. */
  errors?: readonly unknown[];
  /** Closes the open document (also the palette command). Absent when the document cannot be closed. */
  onCloseDocument?: (() => void) | undefined;
}

/**
 * The IDE frame, rendered once by the layout route: top bar, zones, bottom panel and status bar, with the data that
 * every route shares (the catalog count, the session and the version) and the «Problemas» entries of the requests.
 */
const NO_ERRORS: readonly unknown[] = [];

export function IdeFrame({ title, path, left, right, center, errors = NO_ERRORS, onCloseDocument }: IdeFrameProps): ReactElement {
  const translate = useAppText();
  const catalog = useCatalogo();
  const session = useSesion();
  const config = useConfig();
  const shellErrors = useMemo(
    () => [catalog.error, session.error, config.error, ...errors],
    [catalog.error, session.error, config.error, errors],
  );
  useApiProblems(shellErrors);
  const problems = useProblems().list;

  const catalogMessage = catalogStatusMessage(catalog, translate);
  const sessionMessage =
    session.data === undefined
      ? null
      : session.data.local
        ? translate("state.session.local")
        : session.data.dentro
          ? translate("state.session.of", { name: session.data.nombre })
          : translate("state.session.none");
  const versionText = config.data === undefined ? null : versionMessage(config.data.version, UI_VERSION, translate);

  return (
    <AppShell
      title={title}
      top={<IdeTop path={path} onCloseDocument={onCloseDocument} />}
      left={left}
      center={center}
      right={right}
      bottom={<BottomPanel problems={problems} log={<p className="p-3 text-sm text-ink-muted">{translate("log.empty")}</p>} />}
      status={
        <StatusBar message={catalogMessage} problems={problems}>
          {sessionMessage === null ? null : <span className="text-xs text-ink-muted">{sessionMessage}</span>}
          {versionText === null ? null : <span className="font-mono text-xs text-ink-muted">{versionText}</span>}
        </StatusBar>
      }
    />
  );
}

interface IdeTopProps {
  path: readonly string[];
  onCloseDocument: (() => void) | undefined;
}

/** Inside the shell so that the palette sees the zone commands (they need the shell's layout). */
function IdeTop({ path, onCloseDocument }: IdeTopProps): ReactElement {
  const translate = useAppText();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shellCommands = useShellCommands(onCloseDocument === undefined ? {} : { onCloseActiveDocument: onCloseDocument });
  // Recomputed on every render, as the shell's commands are: the translator changes with the locale.
  const commands: readonly Command[] = [
    {
      id: "app.catalog",
      label: translate("actions.catalog"),
      group: translate("group.goto"),
      run: () => {
        void navigate("/");
      },
    },
    ...shellCommands,
  ];

  return (
    <>
      <TopBar
        path={path}
        onOpenPalette={() => {
          setPaletteOpen(true);
        }}
      >
        <LocaleSwitch />
      </TopBar>
      <CommandPalette
        commands={commands}
        open={paletteOpen}
        onOpenChange={(open) => {
          setPaletteOpen(open);
        }}
      />
    </>
  );
}
