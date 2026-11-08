import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { TopBar } from "./TopBar";

beforeEach(() => {
  window.localStorage.clear();
});

describe("<TopBar>", () => {
  it("shows the brand and the case path as a labelled list", () => {
    render(<TopBar path={["Garver 6", "GTEP"]} />);
    expect(screen.getByText("XPAND")).toBeInTheDocument();
    const path = screen.getByRole("list", { name: "Ruta del caso" });
    expect(within(path).getAllByRole("listitem")).toHaveLength(2);
    expect(path).toHaveTextContent(/^Garver 6\s*›\s*GTEP$/);
    expect(within(path).getByText("›")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders the actions slot and the palette button with its shortcut", async () => {
    const user = userEvent.setup();
    const onOpenPalette = vi.fn();
    render(<TopBar actions={<button type="button">Resolver</button>} onOpenPalette={onOpenPalette} />);
    expect(screen.getByRole("button", { name: "Resolver" })).toBeInTheDocument();
    const palette = screen.getByRole("button", { name: /Buscar acción/ });
    expect(palette).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    expect(palette).toHaveAttribute("aria-haspopup", "dialog");
    expect(palette).toHaveAttribute("data-shell-palette-opener");
    expect(within(palette).getByText("Ctrl+K").className).toMatch(/sr-only/);
    await user.click(palette);
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it("omits the palette button when there is no handler, and the zone toggles outside a shell", () => {
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: /Buscar acción/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Explorador" })).toBeNull();
  });

  it("inside a shell offers a persistent toggle for every present zone, wired with ARIA", async () => {
    const user = userEvent.setup();
    render(<AppShell top={<TopBar />} left={<span>árbol</span>} center={<p>c</p>} bottom={<span>problemas</span>} />);
    expect(screen.queryByRole("button", { name: "Inspector" })).toBeNull(); // no right zone given
    const explorer = screen.getByRole("button", { name: "Explorador" });
    const panel = screen.getByRole("button", { name: "Panel" });
    const left = screen.getByRole("complementary", { name: "Explorador del caso" });
    expect(explorer).toHaveAttribute("aria-expanded", "true");
    expect(explorer).toHaveAttribute("aria-controls", left.id);
    expect(explorer).toHaveAttribute("aria-keyshortcuts", "Control+B Meta+B");
    expect(panel).toHaveAttribute("aria-keyshortcuts", "Control+J Meta+J");

    // The state is also shown without color: a data-state the styles key on, and an inset accent rule.
    expect(explorer).toHaveAttribute("data-state", "open");
    expect(explorer.className).toMatch(/inset_0_-2px_0/);
    await user.click(explorer);
    expect(explorer).toHaveAttribute("aria-expanded", "false");
    expect(explorer).toHaveAttribute("data-state", "closed");
    expect(explorer.className).not.toMatch(/inset_0_-2px_0/);
    expect(screen.queryByRole("complementary", { name: "Explorador del caso" })).toBeNull();
    // The target of aria-controls still exists while hidden.
    expect(document.getElementById(left.id)).not.toBeNull();
    await user.click(explorer);
    expect(screen.getByRole("complementary", { name: "Explorador del caso" })).toBeInTheDocument();
  });
});
