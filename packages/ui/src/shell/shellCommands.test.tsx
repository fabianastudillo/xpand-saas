import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { useShellCommands } from "./shellCommands";

function Palette({ onCloseActiveDocument }: { onCloseActiveDocument?: () => void }): React.JSX.Element {
  const commands = useShellCommands(onCloseActiveDocument === undefined ? {} : { onCloseActiveDocument });
  return <CommandPalette commands={commands} />;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useShellCommands", () => {
  it("offers show/hide commands for the present zones, worded after their state", async () => {
    const user = userEvent.setup();
    render(<AppShell left={<span>árbol</span>} center={<Palette />} bottom={<span>problemas</span>} />);
    await user.keyboard("{Control>}k{/Control}");
    // The option's name ends with its shortcut («Ctrl+B»), read from the sr-only text of <Shortcut>.
    expect(screen.getByRole("option", { name: /^Ocultar explorador/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Ocultar panel inferior/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /inspector/i })).toBeNull();
    await user.click(screen.getByRole("option", { name: /^Ocultar explorador/ }));
    expect(screen.queryByRole("complementary", { name: "Explorador del caso" })).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("option", { name: /^Mostrar explorador/ })).toBeInTheDocument();
  });

  it("adds «Cerrar documento activo» only when a handler is given", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { unmount } = render(<AppShell center={<Palette onCloseActiveDocument={close} />} />);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByRole("option", { name: "Cerrar documento activo" }));
    expect(close).toHaveBeenCalledTimes(1);
    unmount();

    render(<AppShell center={<Palette />} />);
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("option", { name: "Cerrar documento activo" })).toBeNull();
  });
});
