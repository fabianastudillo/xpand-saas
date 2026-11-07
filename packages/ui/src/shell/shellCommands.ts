import { useMemo } from "react";
import { t, useLocale, type MessageKey } from "../i18n";
import type { Command } from "./commandFilter";
import { useShellLayout, type ShellLayout, type ZoneState } from "./shellLayoutContext";
import { shortcutLabel } from "./shortcuts";

export interface ShellCommandOptions {
  /** When given, adds «Cerrar documento activo» (the keyboard route to close a tab without Delete). */
  onCloseActiveDocument?: () => void;
}

interface ZoneCommand {
  zone: keyof Pick<ShellLayout, "left" | "right" | "bottom">;
  show: MessageKey;
  hide: MessageKey;
  key: string;
}

const ZONE_COMMANDS: readonly ZoneCommand[] = [
  { zone: "left", show: "shell.command.show.left", hide: "shell.command.hide.left", key: "B" },
  { zone: "right", show: "shell.command.show.right", hide: "shell.command.hide.right", key: "I" },
  { zone: "bottom", show: "shell.command.show.bottom", hide: "shell.command.hide.bottom", key: "J" },
];

function zoneCommand(entry: ZoneCommand, zone: ZoneState, group: string): Command {
  return {
    id: `shell.${entry.zone}`,
    label: t(zone.open ? entry.hide : entry.show),
    group,
    shortcut: shortcutLabel(entry.key),
    run: zone.toggle,
  };
}

/**
 * The shell's own palette commands: show/hide each present zone (worded after its current state) and,
 * optionally, close the active document. The app concatenates them with its own commands.
 */
export function useShellCommands({ onCloseActiveDocument }: ShellCommandOptions = {}): readonly Command[] {
  const locale = useLocale();
  const layout = useShellLayout();
  return useMemo(() => {
    const group = t("shell.command.group");
    const zones = ZONE_COMMANDS.filter((entry) => layout[entry.zone].present).map((entry) =>
      zoneCommand(entry, layout[entry.zone], group),
    );
    const close: readonly Command[] = onCloseActiveDocument
      ? [{ id: "shell.closeDocument", label: t("shell.command.closeDocument"), group, run: onCloseActiveDocument }]
      : [];
    return [...zones, ...close];
    // `locale` re-translates the labels when the language changes.
  }, [layout, onCloseActiveDocument, locale]);
}
