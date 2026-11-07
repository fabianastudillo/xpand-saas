import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { flattenTree, moveFocus, type TreeGroup, type TreeRow } from "./treeModel";
import { useWindowedRows } from "./windowing";

export interface TreeSelection {
  group: string;
  id: string;
}

export interface CaseTreeProps {
  groups: readonly TreeGroup[];
  onSelect: (groupId: string, itemId: string) => void;
  selected?: TreeSelection;
  /** Accessible name of the tree. Default «Árbol del caso». */
  label?: string;
  /** Groups open at first render. Default: all of them. */
  defaultExpanded?: readonly string[];
  className?: string;
}

/** Above this many rows the tree is windowed; below, every row is in the DOM (find-in-page works). */
const WINDOW_THRESHOLD = 200;
const ROW_HEIGHT_PX = 28; // --row-h in normal density; the real height is measured once rendered
const FALLBACK_VIEWPORT_PX = 320;
const OVERSCAN_ROWS = 4;
const INDENT_PX = 12;
const ACTIVATION_KEYS = new Set(["Enter", " "]);
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End", "ArrowLeft", "ArrowRight"]);

const ROW =
  "flex h-(--row-h) cursor-default items-center gap-1.5 pr-2 text-base whitespace-nowrap select-none " +
  "hover:bg-surface-sunken aria-selected:bg-accent-soft " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/**
 * The case explorer: groups (Barras, Líneas, Candidatas…) with their items. Flat `treeitem`s with
 * aria-level / aria-setsize / aria-posinset instead of nested `group`s, because the rows are windowed above
 * 200 and a nested structure cannot be sliced. One tab stop (roving tabindex); arrows, Home and End move,
 * ArrowLeft/ArrowRight collapse/expand, Enter and Space open an item or toggle a group.
 */
export function CaseTree({ groups, onSelect, selected, label, defaultExpanded, className }: CaseTreeProps): ReactElement {
  useLocale();
  // The state is the set of COLLAPSED groups: groups that arrive after mount (the catalog takes seconds) are
  // open by default, and `defaultExpanded` only has to name what starts closed.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () =>
      new Set(defaultExpanded === undefined ? [] : groups.flatMap((group) => (defaultExpanded.includes(group.id) ? [] : [group.id]))),
  );
  const expanded = useMemo(
    () => new Set(groups.flatMap((group) => (collapsed.has(group.id) ? [] : [group.id]))),
    [groups, collapsed],
  );
  const rows = useMemo(() => flattenTree(groups, expanded), [groups, expanded]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const focused = Math.min(focusedIndex, Math.max(0, rows.length - 1));
  const focusPending = useRef(false);

  const { scrollRef, measureRowRef, range, windowed, onScroll, reveal } = useWindowedRows({
    count: rows.length,
    threshold: WINDOW_THRESHOLD,
    defaultRowHeight: ROW_HEIGHT_PX,
    defaultViewportHeight: FALLBACK_VIEWPORT_PX,
    overscan: OVERSCAN_ROWS,
  });

  // After a keyboard move the target row is mounted (reveal ran in the same batch): give it the focus.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    scrollRef.current?.querySelector<HTMLElement>(`[data-index="${String(focused)}"]`)?.focus();
  }, [focused, scrollRef]);

  const focusRow = useCallback(
    (index: number) => {
      focusPending.current = true;
      reveal(index);
      setFocusedIndex(index);
    },
    [reveal],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const activate = (row: TreeRow): void => {
    if (row.kind === "group") toggleGroup(row.groupId);
    else onSelect(row.groupId, row.item.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const row = rows[focused];
    if (!row) return;
    if (ACTIVATION_KEYS.has(event.key)) {
      event.preventDefault();
      activate(row);
      return;
    }
    if (!NAVIGATION_KEYS.has(event.key)) return;
    event.preventDefault();
    if (row.kind === "group" && event.key === "ArrowRight" && !row.expanded) {
      toggleGroup(row.groupId);
      return;
    }
    if (row.kind === "group" && event.key === "ArrowLeft" && row.expanded) {
      toggleGroup(row.groupId);
      return;
    }
    const next = moveFocus(rows, focused, event.key);
    if (next !== focused) focusRow(next);
  };

  const visible = rows.slice(range.start, range.end);

  return (
    <>
      <div
        role="tree"
        aria-label={label ?? t("shell.tree.label")}
        data-slot="case-tree"
        ref={scrollRef}
        onScroll={windowed ? onScroll : undefined}
        onKeyDown={onKeyDown}
        className={cn("min-h-0 flex-1 overflow-auto", className)}
      >
        <div role="none" style={windowed ? { height: range.totalHeight, position: "relative" } : undefined}>
          <div role="none" style={windowed ? { transform: `translateY(${String(range.offsetTop)}px)` } : undefined}>
            {visible.map((row, offset) => {
              const index = range.start + offset;
              return (
                <TreeRowView
                  key={row.key}
                  row={row}
                  index={index}
                  tabbable={index === focused}
                  selected={row.kind === "item" && selected?.group === row.groupId && selected.id === row.item.id}
                  measureRef={offset === 0 ? measureRowRef : undefined}
                  onFocus={() => {
                    setFocusedIndex(index);
                  }}
                  onClick={() => {
                    activate(row);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {rows.length === 0 ? <p className="px-3 py-2 text-sm text-ink-muted">{t("shell.tree.empty")}</p> : null}
    </>
  );
}

interface TreeRowViewProps {
  row: TreeRow;
  index: number;
  tabbable: boolean;
  selected: boolean;
  measureRef: ((element: HTMLElement | null) => void) | undefined;
  onFocus: () => void;
  onClick: () => void;
}

function TreeRowView({ row, index, tabbable, selected, measureRef, onFocus, onClick }: TreeRowViewProps): ReactElement {
  const ariaState =
    row.kind === "group" ? { "aria-expanded": row.expanded } : { "aria-selected": selected };
  return (
    <div
      role="treeitem"
      data-index={index}
      ref={measureRef}
      tabIndex={tabbable ? 0 : -1}
      aria-level={row.level}
      aria-setsize={row.setSize}
      aria-posinset={row.position}
      {...ariaState}
      style={{ paddingLeft: row.level * INDENT_PX }}
      className={cn(ROW, row.kind === "group" && "font-medium")}
      onFocus={onFocus}
      onClick={onClick}
    >
      {row.kind === "group" ? (
        <>
          <span aria-hidden="true" className="w-3 text-center text-ink-muted">
            {row.expanded ? "▾" : "▸"}
          </span>
          <span className="flex-1 truncate">{row.group.label}</span>
          <span className="font-mono text-xs text-ink-muted tabular-nums">{String(row.group.count)}</span>
        </>
      ) : (
        <>
          <span className="flex-1 truncate">{row.item.label}</span>
          {row.item.detail !== undefined ? <span className="text-xs text-ink-muted">{row.item.detail}</span> : null}
        </>
      )}
    </div>
  );
}
