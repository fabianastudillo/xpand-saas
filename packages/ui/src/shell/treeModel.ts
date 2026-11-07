export interface TreeItem {
  id: string;
  label: string;
  /** Secondary text at the right of the row (voltage level, length…). */
  detail?: string;
}

export interface TreeGroup {
  id: string;
  label: string;
  /** Number shown next to the group; may differ from items.length while the case is still loading. */
  count: number;
  items: readonly TreeItem[];
}

interface RowBase {
  key: string;
  level: 1 | 2;
  setSize: number;
  position: number;
  groupId: string;
}

export interface GroupRow extends RowBase {
  kind: "group";
  group: TreeGroup;
  expanded: boolean;
}

export interface ItemRow extends RowBase {
  kind: "item";
  item: TreeItem;
}

export type TreeRow = GroupRow | ItemRow;

export type TreeKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "ArrowLeft" | "ArrowRight";

/** The visible rows, in order: each group and, when expanded, its items. Flat on purpose (see CaseTree). */
export function flattenTree(groups: readonly TreeGroup[], expanded: ReadonlySet<string>): readonly TreeRow[] {
  return groups.flatMap((group, groupIndex): readonly TreeRow[] => {
    const isExpanded = expanded.has(group.id);
    const groupRow: GroupRow = {
      kind: "group",
      key: `g:${group.id}`,
      level: 1,
      setSize: groups.length,
      position: groupIndex + 1,
      groupId: group.id,
      group,
      expanded: isExpanded,
    };
    if (!isExpanded) return [groupRow];
    const itemRows = group.items.map(
      (item, itemIndex): ItemRow => ({
        kind: "item",
        key: `i:${group.id}:${item.id}`,
        level: 2,
        setSize: group.items.length,
        position: itemIndex + 1,
        groupId: group.id,
        item,
      }),
    );
    return [groupRow, ...itemRows];
  });
}

/**
 * Where the focus goes from `index` for a navigation key (WAI-ARIA tree pattern). Expanding and collapsing
 * are not movements and are handled by the component; here ArrowRight on an expanded group enters it and
 * ArrowLeft on an item goes back to its group.
 */
export function moveFocus(rows: readonly TreeRow[], index: number, key: string): number {
  const last = rows.length - 1;
  const row = rows[index];
  switch (key) {
    case "ArrowDown":
      return Math.min(last, index + 1);
    case "ArrowUp":
      return Math.max(0, index - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "ArrowRight":
      return row?.kind === "group" && row.expanded && row.group.items.length > 0 ? index + 1 : index;
    case "ArrowLeft":
      return row?.kind === "item" ? rows.findIndex((candidate) => candidate.key === `g:${row.groupId}`) : index;
    default:
      return index;
  }
}
