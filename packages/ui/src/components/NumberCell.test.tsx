import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { NumberCell } from "./NumberCell";

afterEach(() => {
  setLocale("es");
});

describe("<NumberCell>", () => {
  it("shows 1457,8 MW in Spanish and 1457.8 MW in English, following the active locale", () => {
    render(<NumberCell value={1457.8} unit="MW" digits={1} />);
    const cell = screen.getByTestId("number-cell");
    expect(cell.textContent).toBe("1457,8 MW");

    act(() => {
      setLocale("en");
    });

    expect(cell.textContent).toBe("1457.8 MW");
  });

  it("defaults to one decimal and no unit", () => {
    render(<NumberCell value={110} />);
    expect(screen.getByTestId("number-cell").textContent).toBe("110,0");
  });

  it("uses the monospaced font and fills its cell so the right alignment holds", () => {
    // Layout contract: the root is a block that takes the cell width; in a <td> or a flex row the figure
    // sits on the right edge regardless of the parent's text-align.
    render(<NumberCell value={6} digits={0} />);
    const cell = screen.getByTestId("number-cell");
    expect(cell.className).toMatch(/font-mono/);
    expect(cell.className).toMatch(/tabular-nums/);
    expect(cell.className).toMatch(/\bblock\b/);
    expect(cell.className).toMatch(/\bw-full\b/);
    expect(cell.className).toMatch(/\btext-right\b/);
    expect(cell.className).not.toMatch(/inline-block/);
  });

  it("never wraps between the figure and its unit", () => {
    render(<NumberCell value={1457.8} unit="MW" />);
    expect(screen.getByTestId("number-cell").className).toMatch(/whitespace-nowrap/);
  });

  it("renders an em dash for sighted users and «No disponible» for screen readers", () => {
    render(<NumberCell value={Number.NaN} unit="MW" />);
    const cell = screen.getByTestId("number-cell");
    expect(cell).not.toHaveAttribute("aria-label");
    expect(screen.getByText("—")).toHaveAttribute("aria-hidden", "true");
    const spoken = screen.getByText("No disponible");
    expect(spoken.className).toMatch(/xp-sr-only/);
    expect(screen.queryByText("MW")).toBeNull();
  });

  it("keeps the unit out of the figure so screen readers hear both", () => {
    render(<NumberCell value={340} unit="MW" />);
    expect(screen.getByText("MW")).toBeTruthy();
    expect(screen.getByText("340,0")).toBeTruthy();
  });

  it("speaks a unit label instead of the abbreviation when one is given", () => {
    render(<NumberCell value={110} unit="MUS$" unitLabel="millones de dólares" />);
    const visible = screen.getByText("MUS$");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    const spoken = screen.getByText("millones de dólares");
    expect(spoken.className).toMatch(/xp-sr-only/);
  });

  it("does not hide the unit when there is no spoken label", () => {
    render(<NumberCell value={110} unit="MW" />);
    expect(screen.getByText("MW")).not.toHaveAttribute("aria-hidden");
  });
});
