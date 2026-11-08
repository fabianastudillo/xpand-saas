import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd, Shortcut } from "./Kbd";

describe("<Kbd>", () => {
  it("renders a <kbd> element in the monospaced font", () => {
    render(<Kbd>Esc</Kbd>);
    const kbd = screen.getByText("Esc");
    expect(kbd.tagName).toBe("KBD");
    expect(kbd.className).toMatch(/font-mono/);
  });
});

describe("<Shortcut>", () => {
  it("splits a combination into one <kbd> per key", () => {
    render(<Shortcut keys="Ctrl+Shift+P" />);
    const keys = [...document.querySelectorAll("kbd")].map((k) => k.textContent);
    expect(keys).toEqual(["Ctrl", "Shift", "P"]);
  });

  it("reads the combination as one phrase for assistive technology", () => {
    render(<Shortcut keys="Ctrl+K" />);
    expect(screen.getByText("Ctrl+K").className).toMatch(/xp-sr-only/);
  });
});
