import { useCatalogo, useConfig, useSesion } from "@xpand/api";
import {
  AppShell,
  BottomPanel,
  StatusBar,
  t,
  useLocale,
  useProblems,
  useShellCommands,
  CommandPalette,
  TopBar,
  type Command,
} from "@xpand/ui";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { countSystems } from "../features/explorar/catalog";
import { useAppText } from "../i18n/messages";
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
  /** Query errors of the page itself; the shell reports the catalog, session and version ones. */
  errors?: readonly unknown[];
  /** Closes the open document (also the palette command). Absent when the document cannot be closed. */
  onCloseDocument?: () => void;
}

/**
 * The IDE frame shared by the pages: top bar, zones, bottom panel and status bar, with the data that every page
 * shares (the catalog count, the session and the version) and the «Problemas» entries of the failed requests.
 */
export function IdeFrame({
  title,
  path,
  left,
  right,
  center,
  errors = [],
  onCloseDocument,
}: IdeFrameProps): ReactElement {
  const translate = useAppText();
  const catalog = useCatalogo();
  const session = useSesion();
  const config = useConfig();
  useApiProblems([catalog.error, session.error, config.error, ...errors]);
  const problems = useProblems().list;

  const catalogMessage = catalog.data === undefined ? t("common.loading") : translate("state.catalog", { n: countSystems(catalog.data) });
  const sesionMessage =
    session.data === undefined
      ? null
      : session.data.local
        ? translate("state.session.local")
        : session.data.dentro
          ? translate("state.session.of", { name: session.data.nombre })
          : translate("state.session.none");
  const versionMessage = config.data === undefined ? null : translate("state.version", { version: config.data.version });

  return (
    <AppShell
      title={title}
      top={<IdeTop path={path} onCloseDocument={onCloseDocument} />}
      left={left}
      center={center}
      right={right}
      bottom={
        <BottomPanel
          problems={problems}
          log={<p className="p-3 text-sm text-ink-muted">{translate("log.empty")}</p>}
        />
      }
      status={
        <StatusBar message={catalogMessage} problems={problems}>
          {sesionMessage === null ? null : <span className="text-xs text-ink-muted">{sesionMessage}</span>}
          {versionMessage === null ? null : <span className="font-mono text-xs text-ink-muted">{versionMessage}</span>}
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
  const locale = useLocale();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shellCommands = useShellCommands(
    onCloseDocument === undefined ? {} : { onCloseActiveDocument: onCloseDocument },
  );
  const commands = useMemo<readonly Command[]>(
    () => [
      {
        id: "app.catalog",
        label: translate("actions.catalog"),
        group: translate("group.goto"),
        run: () => {
          void navigate("/");
        },
      },
      ...shellCommands,
    ],
    // `locale` re-translates the labels when the language changes.
    [translate, locale, navigate, shellCommands],
  );

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
