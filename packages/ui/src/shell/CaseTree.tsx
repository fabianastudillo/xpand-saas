import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import { CaseTreeRow } from "./CaseTreeRow";
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
const ACTIVATION_KEYS = new Set(["Enter", " "]);
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End", "ArrowLeft", "ArrowRight"]);

function indexOfSelection(rows: readonly TreeRow[], selected: TreeSelection | undefined): number {
  if (!selected) return -1;
  return rows.findIndex((row) => row.kind === "item" && row.groupId === selected.group && row.item.id === selected.id);
}

/**
 * The case explorer: groups (Barras, Líneas, Candidatas…) with their items. Flat `treeitem`s with
 * aria-level / aria-setsize / aria-posinset instead of nested `group`s, because the rows are windowed above
 * 200 and a nested structure cannot be sliced. One tab stop (roving tabindex) that starts on the selected
 * row; arrows, Home and End move, ArrowLeft/ArrowRight collapse/expand, Enter and Space open an item or
 * toggle a group. The focused row is always mounted, pinned at its own offset when the window scrolls away.
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
  const [focusedIndex, setFocusedIndex] = useState(() => Math.max(0, indexOfSelection(rows, selected)));
  const focused = Math.min(focusedIndex, Math.max(0, rows.length - 1));
  const focusPending = useRef(false);

  const { scrollRef, measureRowRef, range, rowHeight, windowed, onScroll, reveal } = useWindowedRows({
    count: rows.length,
    threshold: WINDOW_THRESHOLD,
    defaultRowHeight: ROW_HEIGHT_PX,
    defaultViewportHeight: FALLBACK_VIEWPORT_PX,
    overscan: OVERSCAN_ROWS,
  });

  // Whether the focus is inside the tree. Removing a focused node fires no blur, so the flag survives the
  // remount of the focused row (window → pinned and back) and the effect below gives the focus back to it.
  const treeHasFocus = useRef(false);
  useEffect(() => {
    const tree = scrollRef.current;
    if (!tree) return;
    const row = tree.querySelector<HTMLElement>(`[data-index="${String(focused)}"]`);
    const shouldFocus = focusPending.current || (treeHasFocus.current && !tree.contains(document.activeElement));
    focusPending.current = false;
    if (shouldFocus && row && document.activeElement !== row) row.focus();
  });

  // A new selection moves the tab stop while the tree is not being navigated.
  const selectedIndex = indexOfSelection(rows, selected);
  useEffect(() => {
    if (selectedIndex < 0) return;
    const tree = scrollRef.current;
    if (tree?.contains(document.activeElement) === true) return;
    setFocusedIndex(selectedIndex);
  }, [selectedIndex, scrollRef]);

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
    if (event.ctrlKey || event.metaKey || event.altKey) return; // Ctrl+Home etc. belong to the browser
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
  const pinned = windowed && (focused < range.start || focused >= range.end) ? rows[focused] : undefined;
  const isSelected = (row: TreeRow): boolean =>
    row.kind === "item" && selected?.group === row.groupId && selected.id === row.item.id;
  const rowProps = (row: TreeRow, index: number) => ({
    row,
    index,
    tabbable: index === focused,
    selected: isSelected(row),
    onFocus: () => {
      setFocusedIndex(index);
    },
    onClick: () => {
      activate(row);
    },
  });

  return (
    <>
      <div
        role="tree"
        aria-label={label ?? t("shell.tree.label")}
        data-slot="case-tree"
        ref={scrollRef}
        onScroll={windowed ? onScroll : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => {
          treeHasFocus.current = true;
        }}
        onBlur={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
            treeHasFocus.current = false;
          }
        }}
        className={cn("min-h-0 flex-1 overflow-auto", className)}
      >
        <div role="none" style={windowed ? { height: range.totalHeight, position: "relative" } : undefined}>
          <div role="none" style={windowed ? { transform: `translateY(${String(range.offsetTop)}px)` } : undefined}>
            {visible.map((row, offset) => (
              <CaseTreeRow
                key={row.key}
                {...rowProps(row, range.start + offset)}
                measureRef={offset === 0 ? measureRowRef : undefined}
              />
            ))}
          </div>
          {pinned ? (
            <CaseTreeRow
              key={pinned.key}
              {...rowProps(pinned, focused)}
              measureRef={undefined}
              style={{ position: "absolute", top: focused * rowHeight, left: 0, right: 0 }}
            />
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? <p className="px-3 py-2 text-sm text-ink-muted">{t("shell.tree.empty")}</p> : null}
    </>
  );
}
