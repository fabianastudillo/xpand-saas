import * as Dialog from "@radix-ui/react-dialog";
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { Shortcut } from "../components/Kbd";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { filterCommands, groupCommands, type Command } from "./commandFilter";
import { useShortcuts } from "./shortcuts";

export interface CommandPaletteProps {
  commands: readonly Command[];
  /** Controlled open state; uncontrolled when omitted. Ctrl+K / ⌘K toggles either way. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const INPUT =
  "h-(--control-h) w-full border-0 border-b border-line bg-transparent px-3 text-base text-ink " +
  "placeholder:text-ink-muted focus-visible:outline-none";

/**
 * Ctrl+K: a dialog (Radix, with focus trap and focus return) over a combobox + listbox of our own, so that
 * filtering ignores accents and the ARIA is exact: the input owns the list through aria-controls and points
 * at the highlighted option with aria-activedescendant. cmdk was not used: its scorer is not accent-aware
 * and its markup is not ours to fix.
 */
export function CommandPalette({ commands, open, onOpenChange }: CommandPaletteProps): ReactElement {
  useLocale();
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = (next: boolean): void => {
    if (open === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  useShortcuts([{ key: "k", whileTyping: true, run: () => { setOpen(!isOpen); } }]);

  // Radix would return the focus to a DialogTrigger, which this palette has none of (it opens from a key):
  // remember who had the focus when it opened (before the focus trap moves it) and give it back on close.
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (isOpen) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [isOpen]);
  const restoreFocus = (event: Event): void => {
    event.preventDefault();
    openerRef.current?.focus();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content
          data-slot="command-palette"
          aria-describedby={undefined}
          onCloseAutoFocus={restoreFocus}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2",
            "overflow-hidden rounded-lg border border-line bg-surface-raised shadow-pop",
          )}
        >
          <Dialog.Title className="xp-sr-only">{t("shell.palette.title")}</Dialog.Title>
          {isOpen ? <PaletteBody commands={commands} close={() => { setOpen(false); }} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface PaletteBodyProps {
  commands: readonly Command[];
  close: () => void;
}

/** Mounted only while open, so query and highlight start fresh every time. */
function PaletteBody({ commands, close }: PaletteBodyProps): ReactElement {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const matches = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => groupCommands(matches), [matches]);
  const active = Math.min(highlight, Math.max(0, matches.length - 1));
  const optionId = (command: Command): string => `${listId}-${command.id}`;

  const run = (command: Command): void => {
    close();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight(Math.min(matches.length - 1, active + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(Math.max(0, active - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = matches[active];
      if (command) run(command);
    }
  };

  return (
    <>
      <input
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={matches[active] ? optionId(matches[active]) : undefined}
        aria-label={t("shell.palette.title")}
        autoComplete="off"
        spellCheck={false}
        placeholder={t("shell.palette.placeholder")}
        className={INPUT}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div id={listId} role="listbox" aria-label={t("shell.palette.results")} className="max-h-80 overflow-auto py-1">
        {groups.map((group) => (
          <div key={group.group} role="group" aria-labelledby={`${listId}-g-${group.group}`}>
            <div id={`${listId}-g-${group.group}`} role="presentation" className="xp-label px-3 pt-2 pb-1">
              {group.group}
            </div>
            {group.commands.map((command) => (
              <PaletteOption
                key={command.id}
                id={optionId(command)}
                command={command}
                selected={matches[active] === command}
                onHover={() => {
                  setHighlight(matches.indexOf(command));
                }}
                onRun={() => {
                  run(command);
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {matches.length === 0 ? (
        <p role="status" className="px-3 py-2 text-sm text-ink-muted">
          {t("shell.palette.empty", { query })}
        </p>
      ) : null}
    </>
  );
}

interface PaletteOptionProps {
  id: string;
  command: Command;
  selected: boolean;
  onHover: () => void;
  onRun: () => void;
}

function PaletteOption({ id, command, selected, onHover, onRun }: PaletteOptionProps): ReactElement {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      className={cn(
        "flex h-(--row-h) cursor-default items-center gap-3 px-3 text-base text-ink",
        selected && "bg-accent-soft",
      )}
      onPointerMove={onHover}
      onClick={onRun}
    >
      <span className="flex-1 truncate">{command.label}</span>
      {command.shortcut === undefined ? null : <Shortcut keys={command.shortcut} className="text-ink-muted" />}
    </div>
  );
}
