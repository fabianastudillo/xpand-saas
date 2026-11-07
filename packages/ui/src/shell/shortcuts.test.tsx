import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isTypingTarget, shortcutLabel, useShortcuts, type ShortcutBinding } from "./shortcuts";

function Harness({ bindings }: { bindings: readonly ShortcutBinding[] }): React.JSX.Element {
  useShortcuts(bindings);
  return (
    <div>
      <button type="button">Foco</button>
      <input aria-label="Nombre" />
      <textarea aria-label="Notas" />
      <div contentEditable aria-label="Editor" tabIndex={0} />
    </div>
  );
}

describe("isTypingTarget", () => {
  it("is true for text inputs, textareas, selects and contenteditable, false for buttons and checkboxes", () => {
    render(<Harness bindings={[]} />);
    expect(isTypingTarget(screen.getByLabelText("Nombre"))).toBe(true);
    expect(isTypingTarget(screen.getByLabelText("Notas"))).toBe(true);
    expect(isTypingTarget(screen.getByLabelText("Editor"))).toBe(true);
    expect(isTypingTarget(screen.getByRole("button"))).toBe(false);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("useShortcuts", () => {
  it("runs the binding on Ctrl+key and on ⌘+key, and prevents the browser default", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Harness bindings={[{ key: "b", run }]} />);
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("{Meta>}B{/Meta}");
    expect(run).toHaveBeenCalledTimes(2);

    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not run while typing, unless the binding opts in", async () => {
    const user = userEvent.setup();
    const bold = vi.fn();
    const palette = vi.fn();
    render(
      <Harness
        bindings={[
          { key: "b", run: bold },
          { key: "k", run: palette, whileTyping: true },
        ]}
      />,
    );
    await user.click(screen.getByLabelText("Nombre"));
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("{Control>}k{/Control}");
    expect(bold).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("ignores plain keys, auto-repeat and events another handler already consumed", () => {
    const run = vi.fn();
    render(<Harness bindings={[{ key: "j", run }]} />);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true, repeat: true, bubbles: true }));
    const consumed = new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true, cancelable: true });
    consumed.preventDefault();
    document.body.dispatchEvent(consumed);
    expect(run).not.toHaveBeenCalled();
  });

  it("evaluates `when` before preventing the default, so a declined event reaches the browser", () => {
    const run = vi.fn();
    render(<Harness bindings={[{ key: "k", run, whileTyping: true, when: () => false }]} />);
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("is silent while a modal dialog is open, unless the binding allows it", () => {
    const zone = vi.fn();
    const palette = vi.fn();
    render(
      <>
        <div role="dialog" aria-modal="true" aria-label="Confirmar" />
        <Harness
          bindings={[
            { key: "b", run: zone },
            { key: "k", run: palette, whileModal: true },
          ]}
        />
      </>,
    );
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    expect(zone).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("also treats an open Radix dialog (role=dialog, data-state=open, no aria-modal) as a modal", () => {
    const zone = vi.fn();
    render(
      <>
        <div role="dialog" data-state="open" aria-label="Paleta" />
        <Harness bindings={[{ key: "b", run: zone }]} />
      </>,
    );
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }));
    expect(zone).not.toHaveBeenCalled();
  });

  it("uses the bindings of the latest render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness bindings={[{ key: "j", run: first }]} />);
    rerender(<Harness bindings={[{ key: "j", run: second }]} />);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unmounted", () => {
    const run = vi.fn();
    const { unmount } = render(<Harness bindings={[{ key: "j", run }]} />);
    unmount();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true }));
    expect(run).not.toHaveBeenCalled();
  });
});

describe("shortcutLabel", () => {
  it("spells the modifier for the platform", () => {
    expect(shortcutLabel("K", false)).toBe("Ctrl+K");
    expect(shortcutLabel("K", true)).toBe("⌘+K");
  });
});
