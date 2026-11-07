import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import type { Command } from "./commandFilter";

function commands(overrides: Partial<Record<string, () => void>> = {}): readonly Command[] {
  const noop = (): void => {};
  return [
    { id: "open-garver", label: "Abrir Garver 6", group: "Casos", run: overrides["open-garver"] ?? noop },
    { id: "open-ieee", label: "Abrir IEEE 24", group: "Casos", run: overrides["open-ieee"] ?? noop },
    { id: "reduce", label: "Reducción a transmisión", group: "Red", run: overrides["reduce"] ?? noop },
    { id: "solve", label: "Resolver", group: "Ejecutar", shortcut: "Ctrl+Enter", run: overrides["solve"] ?? noop },
  ];
}

function Harness({ list = commands() }: { list?: readonly Command[] }): React.JSX.Element {
  return (
    <div>
      <button type="button">Abridor</button>
      <CommandPalette commands={list} />
    </div>
  );
}

describe("<CommandPalette>", () => {
  it("is closed until Ctrl+K, then shows a dialog with a combobox and a listbox", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    const dialog = screen.getByRole("dialog", { name: "Paleta de comandos" });
    const input = within(dialog).getByRole("combobox");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = within(dialog).getByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(within(listbox).getAllByRole("option")).toHaveLength(4);
    expect(within(listbox).getByRole("group", { name: "Casos" })).toBeInTheDocument();
  });

  it("also opens with ⌘K", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("«garver» finds «Abrir Garver 6» and hides the rest", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("garver");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Abrir Garver 6");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", options[0]?.id);
  });

  it("«reduccion» finds «Reducción»", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("reduccion");
    expect(screen.getByRole("option")).toHaveTextContent("Reducción a transmisión");
  });

  it("Esc closes and returns the focus to where it was", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abridor" });
    opener.focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("Ctrl+K while open closes it again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ArrowDown moves the highlight and Enter runs the highlighted command and closes", async () => {
    const user = userEvent.setup();
    const openIeee = vi.fn();
    const openGarver = vi.fn();
    render(<Harness list={commands({ "open-ieee": openIeee, "open-garver": openGarver })} />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{ArrowDown}");
    const second = screen.getByRole("option", { name: /IEEE 24/ });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", second.id);
    await user.keyboard("{Enter}");
    expect(openIeee).toHaveBeenCalledTimes(1);
    expect(openGarver).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("runs a command on click", async () => {
    const user = userEvent.setup();
    const solve = vi.fn();
    render(<Harness list={commands({ solve })} />);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByRole("option", { name: /Resolver/ }));
    expect(solve).toHaveBeenCalledTimes(1);
  });

  it("shows the shortcut of a command as keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Control>}k{/Control}");
    const solve = screen.getByRole("option", { name: /Resolver/ });
    expect(within(solve).getByText("Ctrl+Enter").className).toMatch(/sr-only/);
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("zzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText("Sin resultados para «zzz»")).toBeInTheDocument();
  });

  it("can be controlled from outside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<CommandPalette commands={commands()} open={false} onOpenChange={onOpenChange} />);
    await user.keyboard("{Control>}k{/Control}");
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<CommandPalette commands={commands()} open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
