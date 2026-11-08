import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { CaseTree } from "./CaseTree";
import { Inspector, InspectorRow, InspectorRows } from "./Inspector";
import type { TreeGroup } from "./treeModel";

const garver: readonly TreeGroup[] = [
  { id: "buses", label: "Barras", count: 2, items: [{ id: "b1", label: "Barra 1" }, { id: "b2", label: "Barra 2" }] },
  { id: "lines", label: "Líneas", count: 1, items: [{ id: "1-2", label: "1-2" }] },
];

beforeEach(() => {
  window.localStorage.clear();
});

const leftZone = (): HTMLElement | null => screen.queryByRole("complementary", { name: "Explorador del caso" });

describe("<AppShell> focus management", () => {
  it("moves the focus to <main> when the zone that holds it is collapsed, and keeps the tree state", async () => {
    const user = userEvent.setup();
    render(<AppShell left={<CaseTree groups={garver} onSelect={vi.fn()} />} center={<p>documentos</p>} />);
    const group = screen.getByRole("treeitem", { name: /Barras/ });
    await user.click(group); // collapses «Barras» and focuses the row
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(group).toHaveFocus();

    await user.keyboard("{Control>}b{/Control}");
    expect(leftZone()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();

    await user.keyboard("{Control>}b{/Control}");
    const again = screen.getByRole("treeitem", { name: /Barras/ });
    expect(again).toHaveAttribute("aria-expanded", "false");
    expect(again).toHaveFocus();
  });

  it("returns the focus to the control that opened the zone when it is closed again from there", async () => {
    const user = userEvent.setup();
    render(<AppShell left={<CaseTree groups={garver} onSelect={vi.fn()} />} center={<button type="button">Centro</button>} />);
    await user.keyboard("{Control>}b{/Control}");
    const center = screen.getByRole("button", { name: "Centro" });
    await user.click(center);
    await user.keyboard("{Control>}b{/Control}"); // opens: focus goes to the first tab stop of the zone
    expect(leftZone()).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Control>}b{/Control}"); // closes: back to the opener
    expect(center).toHaveFocus();
  });

  it("sends the focus to <main>, never to <body>, when the zone was opened with nothing focused", async () => {
    const user = userEvent.setup();
    render(<AppShell left={<button type="button">Dentro</button>} center={<p>documentos</p>} />);
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard("{Control>}b{/Control}"); // close, nothing focused
    await user.keyboard("{Control>}b{/Control}"); // open from <body>: the body must not become the opener
    expect(screen.getByRole("button", { name: "Dentro" })).toHaveFocus();
    await user.keyboard("{Control>}b{/Control}"); // close with the focus inside
    expect(screen.getByRole("main")).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("does not return the focus to an opener that is hidden or gone any more", async () => {
    const user = userEvent.setup();
    function Harness(): React.JSX.Element {
      const [withOpener, setWithOpener] = useState(true);
      return (
        <AppShell
          left={<button type="button">Dentro</button>}
          center={
            <div>
              {withOpener ? <button type="button">Abridor</button> : null}
              <button type="button" onClick={() => { setWithOpener(false); }}>
                Quitar abridor
              </button>
            </div>
          }
        />
      );
    }
    render(<Harness />);
    await user.keyboard("{Control>}b{/Control}");
    await user.click(screen.getByRole("button", { name: "Abridor" }));
    await user.keyboard("{Control>}b{/Control}"); // opens, opener = Abridor
    await user.click(screen.getByRole("button", { name: "Quitar abridor" }));
    screen.getByRole("button", { name: "Dentro" }).focus();
    await user.keyboard("{Control>}b{/Control}"); // closes: the opener is gone → main
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("never lets Tab reach a hidden zone", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        left={<button type="button">Dentro</button>}
        center={<button type="button">Centro</button>}
        right={<button type="button">Derecha</button>}
      />,
    );
    await user.keyboard("{Control>}b{/Control}");
    const hidden = screen.getByTestId("shell-left");
    expect(hidden).toHaveAttribute("hidden");
    for (let step = 0; step < 12; step += 1) {
      await user.tab();
      expect(hidden.contains(document.activeElement)).toBe(false);
    }
  });

  it("starts with a skip link that focuses <main>, and has a visually hidden h1", async () => {
    const user = userEvent.setup();
    render(<AppShell title="Garver 6" top={<button type="button">Resolver</button>} center={<p>documentos</p>} />);
    await user.tab();
    const skip = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(skip).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
    const heading = screen.getByRole("heading", { level: 1, name: "Garver 6" });
    expect(heading.className).toMatch(/sr-only/);
  });

  it("makes the inspector zone a tab stop only when it has nothing focusable inside", () => {
    const { rerender } = render(
      <AppShell
        center={<p>documentos</p>}
        right={
          <Inspector title="Barra 2">
            <InspectorRows>
              <InspectorRow label="Pd" value={340} unit="MW" />
            </InspectorRows>
          </Inspector>
        }
      />,
    );
    const right = screen.getByRole("complementary", { name: "Inspector" });
    expect(right).toHaveAttribute("tabindex", "0");
    rerender(<AppShell center={<p>documentos</p>} right={<button type="button">Aplicar</button>} />);
    expect(right).not.toHaveAttribute("tabindex", "0");
    expect(within(right).getByRole("button", { name: "Aplicar" })).toBeInTheDocument();
  });
});
