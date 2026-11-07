import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DocumentTabs, type ShellDocument } from "./DocumentTabs";

const documents: readonly ShellDocument[] = [
  { id: "study", title: "Estudio" },
  { id: "network", title: "Red", dirty: true },
  { id: "plan", title: "Plan · corrida 14:02", closable: false },
];

/** A consumer that really removes the closed document, as the app will. */
function Stateful({ initial, onClose }: { initial: readonly ShellDocument[]; onClose?: (id: string) => void }): React.JSX.Element {
  const [docs, setDocs] = useState(initial);
  const [active, setActive] = useState<string | null>(initial[0]?.id ?? null);
  return (
    <DocumentTabs
      documents={docs}
      activeId={active}
      onActivate={setActive}
      onClose={(id) => {
        onClose?.(id);
        setDocs((current) => current.filter((doc) => doc.id !== id));
      }}
    />
  );
}

describe("<DocumentTabs>", () => {
  it("is a tablist with the active document selected and its content in the panel", () => {
    render(
      <DocumentTabs documents={documents} activeId="network" onActivate={vi.fn()} onClose={vi.fn()}>
        <p>unifilar</p>
      </DocumentTabs>,
    );
    const tablist = screen.getByRole("tablist", { name: "Documentos abiertos" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("unifilar");
  });

  it("activates on click and with the arrow keys", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<DocumentTabs documents={documents} activeId="study" onActivate={onActivate} onClose={vi.fn()} />);
    await user.tab();
    expect(screen.getByRole("tab", { name: /Estudio/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onActivate).toHaveBeenLastCalledWith("network");
    await user.click(screen.getByRole("tab", { name: /Plan/ }));
    expect(onActivate).toHaveBeenLastCalledWith("plan");
  });

  it("marks unsaved documents in text, after a separator, not only with a dot", () => {
    render(<DocumentTabs documents={documents} activeId="study" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Red, Sin guardar" })).toBeInTheDocument();
  });

  it("has no button inside the tablist: the × is decorative for pointer users, Delete and Ctrl+Backspace close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <DocumentTabs documents={documents} activeId="study" onActivate={vi.fn()} onClose={onClose} />,
    );
    const tablist = screen.getByRole("tablist");
    expect(within(tablist).queryByRole("button")).toBeNull();
    const tab = screen.getByRole("tab", { name: /Estudio/ });
    expect(tab).toHaveAttribute("aria-keyshortcuts", "Delete Control+Backspace");
    expect(tab.getAttribute("aria-describedby")).not.toBeNull();
    expect(document.getElementById(tab.getAttribute("aria-describedby") ?? "")).toHaveTextContent(/Suprimir/);

    await user.tab();
    await user.keyboard("{Delete}");
    expect(onClose).toHaveBeenLastCalledWith("study");
    await user.keyboard("{Control>}{Backspace}{/Control}");
    expect(onClose).toHaveBeenLastCalledWith("study");

    const closes = container.querySelectorAll<HTMLElement>("[data-slot='document-close']");
    expect(closes).toHaveLength(2); // the pinned document has none
    const closeRed = closes[1] as HTMLElement;
    expect(closeRed).toHaveAttribute("aria-hidden", "true");
    expect(closeRed.tabIndex).toBe(-1);
    expect(closeRed.className).toMatch(/\bh-6\b/);
    expect(closeRed.className).toMatch(/\bw-6\b/);
    await user.click(closeRed);
    expect(onClose).toHaveBeenLastCalledWith("network");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("moves the focus to the neighbouring tab after closing: the next one, or the previous one at the end", async () => {
    const user = userEvent.setup();
    render(<Stateful initial={documents.map((doc) => ({ ...doc, closable: true }))} />);
    await user.tab();
    await user.keyboard("{Delete}"); // closes Estudio
    expect(screen.queryByRole("tab", { name: /Estudio/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /Red/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // Plan, the last one
    await user.keyboard("{Delete}");
    expect(screen.queryByRole("tab", { name: /Plan/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /Red/ })).toHaveFocus();
  });

  it("does not offer to close a document marked closable: false", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <DocumentTabs documents={documents} activeId="plan" onActivate={vi.fn()} onClose={onClose} />,
    );
    expect(container.querySelectorAll("[data-slot='document-close']")).toHaveLength(2);
    await user.tab();
    expect(screen.getByRole("tab", { name: /Plan/ })).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says when there is nothing open", () => {
    render(<DocumentTabs documents={[]} activeId={null} onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("No hay documentos abiertos")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
