import { describe, expect, it } from "vitest";
import { flattenTree, moveFocus, type TreeGroup } from "./treeModel";

const groups: readonly TreeGroup[] = [
  { id: "buses", label: "Barras", count: 2, items: [{ id: "b1", label: "Barra 1" }, { id: "b2", label: "Barra 2" }] },
  { id: "lines", label: "Líneas", count: 1, items: [{ id: "l1", label: "1-2", detail: "150 MW" }] },
];

describe("flattenTree", () => {
  it("lists group rows and the items of the expanded groups, with level, size and position", () => {
    const rows = flattenTree(groups, new Set(["buses"]));
    expect(rows.map((row) => row.key)).toEqual(["g:buses", "i:buses:b1", "i:buses:b2", "g:lines"]);
    expect(rows[0]).toMatchObject({ kind: "group", level: 1, setSize: 2, position: 1, expanded: true });
    expect(rows[1]).toMatchObject({ kind: "item", level: 2, setSize: 2, position: 1, groupId: "buses" });
    expect(rows[3]).toMatchObject({ kind: "group", level: 1, setSize: 2, position: 2, expanded: false });
  });
});

describe("moveFocus", () => {
  const rows = flattenTree(groups, new Set(["buses", "lines"]));

  it("moves with the arrows and clamps at the ends", () => {
    expect(moveFocus(rows, 0, "ArrowDown")).toBe(1);
    expect(moveFocus(rows, 4, "ArrowDown")).toBe(4);
    expect(moveFocus(rows, 0, "ArrowUp")).toBe(0);
    expect(moveFocus(rows, 3, "ArrowUp")).toBe(2);
  });

  it("jumps with Home and End", () => {
    expect(moveFocus(rows, 3, "Home")).toBe(0);
    expect(moveFocus(rows, 0, "End")).toBe(4);
  });

  it("ArrowLeft on an item goes to its group; ArrowRight on an expanded group goes to its first item", () => {
    expect(moveFocus(rows, 2, "ArrowLeft")).toBe(0);
    expect(moveFocus(rows, 3, "ArrowRight")).toBe(4);
  });

  it("returns the same index for keys it does not handle", () => {
    expect(moveFocus(rows, 1, "Tab")).toBe(1);
  });
});
