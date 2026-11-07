import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleName } from "./LocaleName";

describe("<LocaleName>", () => {
  it("renders the endonym with its own lang attribute, whatever the active locale", () => {
    render(
      <>
        <LocaleName locale="es" />
        <LocaleName locale="en" />
      </>,
    );
    expect(screen.getByText("Español")).toHaveAttribute("lang", "es");
    expect(screen.getByText("English")).toHaveAttribute("lang", "en");
  });
});
