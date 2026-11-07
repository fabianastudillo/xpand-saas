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

  it("uses the monospaced font and aligns to the right", () => {
    render(<NumberCell value={6} digits={0} />);
    const cell = screen.getByTestId("number-cell");
    expect(cell.className).toMatch(/font-mono/);
    expect(cell.className).toMatch(/text-right/);
    expect(cell.className).toMatch(/tabular-nums/);
  });

  it("renders an em dash and says why when the value is not a number", () => {
    render(<NumberCell value={Number.NaN} unit="MW" />);
    const cell = screen.getByTestId("number-cell");
    expect(cell.textContent).toBe("—");
    expect(cell).toHaveAttribute("aria-label", "No disponible");
  });

  it("keeps the unit out of the figure so screen readers hear both", () => {
    render(<NumberCell value={340} unit="MW" />);
    expect(screen.getByText("MW")).toBeTruthy();
    expect(screen.getByText("340,0")).toBeTruthy();
  });
});
