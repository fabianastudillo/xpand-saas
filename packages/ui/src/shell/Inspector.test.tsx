import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inspector, InspectorRow, InspectorRows } from "./Inspector";

describe("<Inspector>", () => {
  it("shows an empty message when nothing is selected, inside a group named by its heading", () => {
    render(<Inspector />);
    expect(screen.getByRole("heading", { name: "Propiedades" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Propiedades" })).toBeInTheDocument();
    expect(screen.getByText("Selecciona un elemento para ver sus propiedades.")).toBeInTheDocument();
  });

  it("titles the selection and renders its rows as a description list", () => {
    render(
      <Inspector title="Barra 2">
        <InspectorRows>
          <InspectorRow label="Pd" value={340} unit="MW" />
          <InspectorRow label="Tipo" value="PQ" />
        </InspectorRows>
      </Inspector>,
    );
    expect(screen.getByRole("heading", { name: "Propiedades · Barra 2" })).toBeInTheDocument();
    const terms = screen.getAllByRole("term");
    expect(terms.map((term) => term.textContent)).toEqual(["Pd", "Tipo"]);
    const figure = screen.getByTestId("number-cell");
    expect(figure).toHaveTextContent("340,0 MW");
    expect(figure.className).toMatch(/font-mono/);
    expect(screen.getByText("PQ")).toBeInTheDocument();
  });
});
