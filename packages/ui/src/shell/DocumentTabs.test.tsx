import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentTabs, type ShellDocument } from "./DocumentTabs";

const documents: readonly ShellDocument[] = [
  { id: "study", title: "Estudio" },
  { id: "network", title: "Red", dirty: true },
  { id: "plan", title: "Plan · corrida 14:02", closable: false },
];

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

  it("marks unsaved documents in text, not only with a dot", () => {
    render(<DocumentTabs documents={documents} activeId="study" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /Red.*Sin guardar/ })).toBeInTheDocument();
  });

  it("closes with the Delete key on the focused tab and with the close button, which is not a tab stop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DocumentTabs documents={documents} activeId="study" onActivate={vi.fn()} onClose={onClose} />);
    await user.tab();
    await user.keyboard("{Delete}");
    expect(onClose).toHaveBeenCalledWith("study");

    const close = screen.getByRole("button", { name: "Cerrar Red" });
    expect(close.tabIndex).toBe(-1);
    expect(screen.getByRole("tab", { name: /Red/ })).not.toContainElement(close);
    await user.click(close);
    expect(onClose).toHaveBeenLastCalledWith("network");
  });

  it("does not offer to close a document marked closable: false", () => {
    render(<DocumentTabs documents={documents} activeId="study" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Cerrar Plan/ })).toBeNull();
  });

  it("says when there is nothing open", () => {
    render(<DocumentTabs documents={[]} activeId={null} onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("No hay documentos abiertos")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
