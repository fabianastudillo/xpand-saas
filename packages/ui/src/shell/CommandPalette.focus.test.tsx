import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { PaletteBody } from "./PaletteBody";
import type { Command } from "./commandFilter";

const noop = (): void => {};

function Harness({ list }: { list: readonly Command[] }): React.JSX.Element {
  return (
    <div>
      <button type="button" data-shell-palette-opener="">
        Buscar acción
      </button>
      <button type="button">Abridor</button>
      <input aria-label="Destino" />
      <main tabIndex={-1}>centro</main>
      <CommandPalette commands={list} />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // A userAgent defined on the instance (macOS test) shadows the prototype getter; remove it.
  if (Object.prototype.hasOwnProperty.call(navigator, "userAgent")) {
    Reflect.deleteProperty(navigator, "userAgent");
  }
});

describe("<CommandPalette> focus and announcements", () => {
  it("runs the command after restoring the focus, so a command that moves the focus wins", async () => {
    const user = userEvent.setup();
    const focusInput = vi.fn(() => {
      screen.getByLabelText("Destino").focus();
    });
    render(<Harness list={[{ id: "go", label: "Ir al destino", group: "Navegar", run: focusInput }]} />);
    screen.getByRole("button", { name: "Abridor" }).focus();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Enter}");
    expect(focusInput).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Destino")).toHaveFocus();
  });

  it("falls back to the palette opener button when nothing had the focus (Safari)", async () => {
    const user = userEvent.setup();
    render(<Harness list={[{ id: "a", label: "Acción", group: "G", run: noop }]} />);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Buscar acción" })).toHaveFocus();
  });

  it("uses index-based ids for groups and options, whatever the labels contain", async () => {
    const user = userEvent.setup();
    render(<Harness list={[{ id: "red", label: "Reducción a transmisión", group: "Red / Análisis", run: noop }]} />);
    await user.keyboard("{Control>}k{/Control}");
    const option = screen.getByRole("option");
    const group = screen.getByRole("group", { name: "Red / Análisis" });
    expect(option.id).toMatch(/-o0$/);
    expect(group.getAttribute("aria-labelledby")).toMatch(/-g0$/);
    expect(document.getElementById(group.getAttribute("aria-labelledby") ?? "")).toHaveTextContent("Red / Análisis");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", option.id);
  });

  it("scrolls the highlighted option into view", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    render(
      <Harness
        list={[
          { id: "a", label: "Primera", group: "G", run: noop },
          { id: "b", label: "Segunda", group: "G", run: noop },
        ]}
      />,
    );
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{ArrowDown}");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
  });

  it("keeps the highlight at zero and ignores Enter when nothing matches", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Harness list={[{ id: "a", label: "Acción", group: "G", run }]} />);
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("zzz{ArrowDown}{ArrowDown}{Enter}");
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Backspace}{Backspace}{Backspace}");
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });

  it("ignores Enter while an IME composition is in progress", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Harness list={[{ id: "a", label: "Acción", group: "G", run }]} />);
    await user.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("announces the number of results in a persistent status region, debounced", () => {
    vi.useFakeTimers();
    try {
      render(
        <PaletteBody
          onChoose={noop}
          commands={[
            { id: "a", label: "Abrir Garver 6", group: "Casos", run: noop },
            { id: "b", label: "Abrir IEEE 24", group: "Casos", run: noop },
          ]}
        />,
      );
      const status = screen.getByRole("status");
      expect(status.className).toMatch(/sr-only/);
      expect(status).toHaveTextContent("");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(status).toHaveTextContent("2 resultados");
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "garver" } });
      expect(status).toHaveTextContent("2 resultados"); // not yet: debounced
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(status).toHaveTextContent("1 resultado");
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "garverzz" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(status).toHaveTextContent("Sin resultados");
      expect(screen.getByText("Sin resultados para «garverzz»")).not.toHaveAttribute("role");
    } finally {
      vi.useRealTimers();
    }
  });

  it("on macOS, Ctrl+K inside a text field is left to the field; ⌘K still opens", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
      configurable: true,
    });
    const user = userEvent.setup();
    render(<Harness list={[{ id: "a", label: "Acción", group: "G", run: noop }]} />);
    await user.click(screen.getByLabelText("Destino"));
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not open over another modal dialog", async () => {
    const user = userEvent.setup();
    render(
      <>
        <div role="dialog" aria-modal="true" aria-label="Confirmar">
          <button type="button">Sí</button>
        </div>
        <CommandPalette commands={[{ id: "a", label: "Acción", group: "G", run: noop }]} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Sí" }));
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog", { name: "Paleta de comandos" })).toBeNull();
  });
});
