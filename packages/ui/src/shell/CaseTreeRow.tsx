import type { CSSProperties, ReactElement } from "react";
import { formatNumber } from "../i18n";
import { cn } from "../lib/cn";
import type { TreeRow } from "./treeModel";

const INDENT_PX = 12;

const ROW =
  "flex h-(--row-h) cursor-default items-center gap-1.5 pr-2 text-base whitespace-nowrap select-none " +
  "border-l-[3px] border-transparent hover:bg-surface-sunken " +
  // Selection: tint, an inline-start bar and weight, so it does not rely on color alone.
  "aria-selected:border-accent aria-selected:bg-accent-soft aria-selected:font-medium " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

export interface CaseTreeRowProps {
  row: TreeRow;
  index: number;
  tabbable: boolean;
  selected: boolean;
  /** Measures the first row and/or tracks the focused one (see CaseTree). */
  rowRef: ((element: HTMLElement | null) => void) | undefined;
  /** Set when the row is pinned outside the window (absolute position at its own offset). */
  style?: CSSProperties;
  onFocus: () => void;
  onClick: () => void;
}

/** One flat treeitem: a group (with its count) or an item (with its detail). */
export function CaseTreeRow({
  row,
  index,
  tabbable,
  selected,
  rowRef,
  style,
  onFocus,
  onClick,
}: CaseTreeRowProps): ReactElement {
  return (
    // The keys of the tree are handled by its root (CaseTree onKeyDown, roving tab stop): a row is not a key target itself.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard activation is on the tree root
    <div
      role="treeitem"
      data-index={index}
      ref={rowRef}
      tabIndex={tabbable ? 0 : -1}
      aria-level={row.level}
      aria-setsize={row.setSize}
      aria-posinset={row.position}
      aria-selected={row.kind === "item" ? selected : false}
      aria-expanded={row.kind === "group" ? row.expanded : undefined}
      style={{ ...style, paddingLeft: row.level * INDENT_PX }}
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
          <span className="font-mono text-xs text-ink-muted tabular-nums">
            {formatNumber(row.group.count, { digits: 0 })}
          </span>
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
