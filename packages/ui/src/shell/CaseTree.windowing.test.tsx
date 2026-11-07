import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseTree } from "./CaseTree";
import type { TreeGroup } from "./treeModel";

function buses(count: number): TreeGroup {
  return {
    id: "buses",
    label: "Barras",
    count,
    items: Array.from({ length: count }, (_, index) => ({ id: `b${String(index + 1)}`, label: `Barra ${String(index + 1)}` })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<CaseTree> windowing", () => {
  it("keeps the focused row mounted and tabbable when the list is scrolled away from it", async () => {
    const user = userEvent.setup();
    render(<CaseTree groups={[buses(938)]} onSelect={vi.fn()} />);
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    const row = screen.getByRole("treeitem", { name: /^Barra 3$/ });
    expect(row).toHaveFocus();

    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const tree = screen.getByRole("tree");
    fireEvent.scroll(tree, { target: { scrollTop: 20_000 } });
    expect(screen.getByRole("treeitem", { name: /^Barra 715$/ })).toBeInTheDocument(); // the window moved
    expect(screen.queryByRole("treeitem", { name: /^Barra 4$/ })).toBeNull();
    const pinned = screen.getByRole("treeitem", { name: /^Barra 3$/ });
    expect(pinned).not.toBe(row); // remounted outside the window
    expect(pinned).toHaveFocus();
    expect(pinned.tabIndex).toBe(0);
    expect(screen.getAllByRole("treeitem").filter((item) => item.tabIndex === 0)).toHaveLength(1);
    // The restore must not scroll the tree back to the row: the user is scrolling away on purpose.
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(tree.scrollTop).toBe(20_000);
    focus.mockRestore();

    await user.tab({ shift: true });
    expect(pinned).not.toHaveFocus();
    await user.tab();
    expect(screen.getByRole("treeitem", { name: /^Barra 3$/ })).toHaveFocus();
  });

  it("does not take the focus back when the user had left the tree before the row remounted", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CaseTree groups={[buses(938)]} onSelect={vi.fn()} />
        <button type="button">Fuera</button>
      </>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.click(screen.getByRole("button", { name: "Fuera" }));
    fireEvent.scroll(screen.getByRole("tree"), { target: { scrollTop: 20_000 } });
    expect(screen.getByRole("button", { name: "Fuera" })).toHaveFocus();
    expect(screen.getByRole("treeitem", { name: /^Barra 1$/ }).tabIndex).toBe(0); // still the tab stop
  });

  it("enters on the selected row, also when it is far down the windowed list", async () => {
    const user = userEvent.setup();
    render(<CaseTree groups={[buses(938)]} onSelect={vi.fn()} selected={{ group: "buses", id: "b500" }} />);
    await user.tab();
    const selected = screen.getByRole("treeitem", { name: /^Barra 500$/ });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: /^Barra 501$/ })).toHaveFocus();
  });

  it("moves the tab stop to a new selection while the tree is not focused", () => {
    const { rerender } = render(<CaseTree groups={[buses(10)]} onSelect={vi.fn()} selected={{ group: "buses", id: "b2" }} />);
    expect(screen.getByRole("treeitem", { name: /^Barra 2$/ }).tabIndex).toBe(0);
    rerender(<CaseTree groups={[buses(10)]} onSelect={vi.fn()} selected={{ group: "buses", id: "b7" }} />);
    expect(screen.getByRole("treeitem", { name: /^Barra 7$/ }).tabIndex).toBe(0);
    expect(screen.getByRole("treeitem", { name: /^Barra 2$/ }).tabIndex).toBe(-1);
  });

  it("ignores the navigation keys when a modifier is held", async () => {
    const user = userEvent.setup();
    render(<CaseTree groups={[buses(10)]} onSelect={vi.fn()} />);
    await user.tab();
    const group = screen.getByRole("treeitem", { name: /Barras/ });
    await user.keyboard("{Control>}{ArrowDown}{/Control}{Alt>}{End}{/Alt}{Meta>}{ArrowRight}{/Meta}");
    expect(group).toHaveFocus();
    expect(group).toHaveAttribute("aria-expanded", "true");
  });

  it("re-measures the row height when the first row resizes (compact density)", () => {
    const callbacks: ResizeObserverCallback[] = [];
    class Observer {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 28 } as DOMRect);
    const { container } = render(<CaseTree groups={[buses(938)]} onSelect={vi.fn()} />);
    const sizer = container.querySelector<HTMLElement>("[data-slot='case-tree'] > [role='none']");
    expect(sizer?.style.height).toBe(`${String(939 * 28)}px`);

    rect.mockReturnValue({ height: 24 } as DOMRect); // compact density
    act(() => {
      for (const callback of callbacks) callback([], {} as ResizeObserver);
    });
    expect(sizer?.style.height).toBe(`${String(939 * 24)}px`);
    vi.unstubAllGlobals();
  });

  it("shows the group count without thousands grouping, in the active locale", () => {
    render(<CaseTree groups={[buses(1457)]} onSelect={vi.fn()} />);
    expect(screen.getByText("1457")).toBeInTheDocument();
  });
});
