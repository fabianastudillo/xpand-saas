import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaseTree } from "./CaseTree";
import type { TreeGroup } from "./treeModel";

function buses(count: number): TreeGroup {
  return {
    id: "buses",
    label: "Barras",
    count,
    items: Array.from({ length: count }, (_, index) => ({
      id: `b${String(index + 1)}`,
      label: `Barra ${String(index + 1)}`,
      detail: "138 kV",
    })),
  };
}

const garver: readonly TreeGroup[] = [
  buses(6),
  { id: "lines", label: "Líneas", count: 2, items: [{ id: "1-2", label: "1-2" }, { id: "2-3", label: "2-3" }] },
];

describe("<CaseTree>", () => {
  it("is a tree of treeitems with level, size and position, groups expanded by default", () => {
    render(<CaseTree groups={garver} onSelect={vi.fn()} />);
    const tree = screen.getByRole("tree");
    const items = within(tree).getAllByRole("treeitem");
    expect(items).toHaveLength(2 + 6 + 2);
    expect(items[0]).toHaveAttribute("aria-level", "1");
    expect(items[0]).toHaveAttribute("aria-expanded", "true");
    expect(items[0]).toHaveAttribute("aria-setsize", "2");
    expect(items[1]).toHaveAttribute("aria-level", "2");
    expect(items[1]).toHaveAttribute("aria-posinset", "1");
    expect(items[1]).toHaveAttribute("aria-setsize", "6");
    expect(items[1]).not.toHaveAttribute("aria-expanded");
  });

  it("shows the count of each group in a figure cell", () => {
    render(<CaseTree groups={garver} onSelect={vi.fn()} />);
    const group = screen.getByRole("treeitem", { name: /Barras/ });
    expect(within(group).getByText("6").className).toMatch(/font-mono/);
  });

  it("mounts fewer than 100 DOM nodes for 938 items", () => {
    const { container } = render(<CaseTree groups={[buses(938)]} onSelect={vi.fn()} />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(container.querySelectorAll("*").length).toBeLessThan(100);
  });

  it("renders every row when the tree is small", () => {
    render(<CaseTree groups={[buses(150)]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("treeitem")).toHaveLength(151);
  });

  it("has one tab stop, moves with the arrows, Home and End, and opens with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CaseTree groups={garver} onSelect={onSelect} />);
    await user.tab();
    const group = screen.getByRole("treeitem", { name: /Barras/ });
    expect(group).toHaveFocus();
    expect(screen.getAllByRole("treeitem").filter((item) => item.tabIndex === 0)).toHaveLength(1);

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: /Barra 1/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: /Barra 3/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("buses", "b3");

    await user.keyboard("{End}");
    expect(screen.getByRole("treeitem", { name: /2-3/ })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(group).toHaveFocus();
    await user.tab();
    expect(group).not.toHaveFocus();
  });

  it("collapses and expands a group with ArrowLeft, ArrowRight and Enter", async () => {
    const user = userEvent.setup();
    render(<CaseTree groups={garver} onSelect={vi.fn()} />);
    await user.tab();
    const group = screen.getByRole("treeitem", { name: /Barras/ });
    await user.keyboard("{ArrowLeft}");
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Barra 1/ })).toBeNull();
    await user.keyboard("{ArrowRight}");
    expect(group).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("treeitem", { name: /Barra 1/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(group).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(group).toHaveAttribute("aria-expanded", "false");
  });

  it("reaches the last of 938 items with End and opens it with Enter, even though it starts unmounted", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CaseTree groups={[buses(938)]} onSelect={onSelect} />);
    expect(screen.queryByRole("treeitem", { name: /Barra 938/ })).toBeNull();
    await user.tab();
    await user.keyboard("{End}");
    expect(screen.getByRole("treeitem", { name: /Barra 938/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("buses", "b938");
    await user.keyboard("{Home}");
    expect(screen.getByRole("treeitem", { name: /Barras/ })).toHaveFocus();
  });

  it("selects on click and marks the selected item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CaseTree groups={garver} onSelect={onSelect} selected={{ group: "lines", id: "1-2" }} />);
    expect(screen.getByRole("treeitem", { name: /1-2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: /2-3/ })).toHaveAttribute("aria-selected", "false");
    await user.click(screen.getByRole("treeitem", { name: /Barra 2/ }));
    expect(onSelect).toHaveBeenCalledWith("buses", "b2");
    await user.click(screen.getByRole("treeitem", { name: /Líneas/ }));
    expect(screen.queryByRole("treeitem", { name: /2-3/ })).toBeNull();
  });

  it("opens the groups that arrive after mount (the catalog loads asynchronously)", () => {
    const { rerender } = render(<CaseTree groups={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("Sin elementos")).toBeInTheDocument();
    rerender(<CaseTree groups={garver} onSelect={vi.fn()} />);
    expect(screen.getByRole("treeitem", { name: /Barra 1/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Barras/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("starts with only the groups in defaultExpanded open", () => {
    render(<CaseTree groups={garver} onSelect={vi.fn()} defaultExpanded={["lines"]} />);
    expect(screen.getByRole("treeitem", { name: /Barras/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("treeitem", { name: /Líneas/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("names the tree and says when it is empty", () => {
    render(<CaseTree groups={[]} onSelect={vi.fn()} />);
    expect(screen.getByRole("tree", { name: "Árbol del caso" })).toBeInTheDocument();
    expect(screen.getByText("Sin elementos")).toBeInTheDocument();
  });
});
