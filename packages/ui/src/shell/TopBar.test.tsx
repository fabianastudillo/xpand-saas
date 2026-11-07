import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

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
    expect(within(palette).getByText("Ctrl+K").className).toMatch(/sr-only/);
    await user.click(palette);
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it("omits the palette button when there is no handler", () => {
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: /Buscar acción/ })).toBeNull();
  });
});
