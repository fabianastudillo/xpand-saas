import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactElement } from "react";
import { Shortcut } from "../components/Kbd";
import { t } from "../i18n";
import { filterCommands, groupCommands, type Command } from "./commandFilter";

export interface PaletteBodyProps {
  commands: readonly Command[];
  onChoose: (command: Command) => void;
}

const INPUT =
  "h-(--control-h) w-full border-0 border-b border-line bg-transparent px-3 text-base text-ink " +
  "placeholder:text-ink-muted focus-visible:outline-none";

const OPTION =
  "flex h-(--row-h) cursor-default items-center gap-3 border-l-[3px] border-transparent px-3 text-base text-ink " +
  // Highlight: tint, an inline-start bar and weight, never color alone.
  "aria-selected:border-accent aria-selected:bg-accent-soft aria-selected:font-medium";

/** Result counts are read out this long after the last change, so typing is not narrated key by key. */
const ANNOUNCE_MS = 250;

function resultsAnnouncement(count: number): string {
  if (count === 0) return t("shell.palette.noResults");
  return count === 1 ? t("shell.palette.results.one") : t("shell.palette.results.many", { n: count });
}

/**
 * The combobox + grouped listbox of the palette. Mounted only while open, so query and highlight start
 * fresh every time. Ids are index-based (labels may hold spaces and accents). ↓/↑ move the highlight,
 * Enter chooses (ignored during IME composition), click chooses, hover highlights.
 */
export function PaletteBody({ commands, onChoose }: PaletteBodyProps): ReactElement {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [announced, setAnnounced] = useState("");
  const listId = useId();
  const matches = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => groupCommands(matches), [matches]);
  const active = matches.length === 0 ? 0 : Math.min(highlight, matches.length - 1);
  const activeCommand = matches[active];
  const optionId = (command: Command): string => `${listId}-o${String(matches.indexOf(command))}`;
  const activeId = activeCommand ? optionId(activeCommand) : undefined;

  // Keyed on the command too: a new filter can put another command under the same index-based id.
  useEffect(() => {
    if (activeId !== undefined) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, activeCommand]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnnounced(resultsAnnouncement(matches.length));
    }, ANNOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [matches.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight(Math.max(0, Math.min(matches.length - 1, active + 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(Math.max(0, active - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeCommand) onChoose(activeCommand);
    }
  };

  return (
    <>
      <input
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
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
        {groups.map((group, groupIndex) => {
          const headingId = `${listId}-g${String(groupIndex)}`;
          return (
            <div key={group.group} role="group" aria-labelledby={headingId}>
              <div id={headingId} role="presentation" className="xp-label px-3 pt-2 pb-1">
                {group.group}
              </div>
              {group.commands.map((command) => (
                <div
                  key={command.id}
                  id={optionId(command)}
                  role="option"
                  aria-selected={command === activeCommand}
                  className={OPTION}
                  onPointerMove={() => {
                    setHighlight(matches.indexOf(command));
                  }}
                  onClick={() => {
                    onChoose(command);
                  }}
                >
                  <span className="flex-1 truncate">{command.label}</span>
                  {command.shortcut === undefined ? null : <Shortcut keys={command.shortcut} className="text-ink-muted" />}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {matches.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-muted">{t("shell.palette.empty", { query })}</p>
      ) : null}
      <div role="status" aria-live="polite" aria-atomic="true" className="xp-sr-only">
        {announced}
      </div>
    </>
  );
}
