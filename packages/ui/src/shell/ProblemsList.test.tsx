import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProblemsList } from "./ProblemsList";
import type { Problem } from "./problems";

const problems: readonly Problem[] = [
  {
    id: "reserva",
    severity: "warn",
    title: "Reserva firme insuficiente",
    cause: "1140 MW de 1457,8 MW exigidos",
    target: { kind: "bus", id: "2" },
  },
  { id: "sesion", severity: "error", title: "Sesión caducada", action: { label: "Entrar", run: vi.fn() } },
  { id: "baron", severity: "info", title: "BARON no está disponible" },
  { id: "tension", severity: "warn", title: "Tensión fuera de rango" },
];

describe("<ProblemsList>", () => {
  it("groups by severity, errors first, with counts in the headings", () => {
    render(<ProblemsList problems={problems} />);
    const headings = screen.getAllByRole("heading");
    expect(headings.map((heading) => heading.textContent)).toEqual(["Errores (1)", "Avisos (2)", "Información (1)"]);
  });

  it("says the severity in text next to an icon that is hidden from assistive technology", () => {
    render(<ProblemsList problems={[problems[1] as Problem]} />);
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Error:").className).toMatch(/sr-only/);
    const icon = item.querySelector("[aria-hidden='true']");
    expect(icon).not.toBeNull();
  });

  it("renders the cause under the title", () => {
    render(<ProblemsList problems={[problems[0] as Problem]} />);
    expect(screen.getByText("1140 MW de 1457,8 MW exigidos")).toBeInTheDocument();
  });

  it("shows the action of a problem as a button and runs it", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <ProblemsList
        problems={[{ id: "sesion", severity: "error", title: "Sesión caducada", action: { label: "Entrar", run } }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("offers to go to the target element and calls onNavigate with it", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<ProblemsList problems={[problems[0] as Problem]} onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: "Ir a barra 2" }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "bus", id: "2" });
  });

  it("does not offer navigation without a target or without a handler", () => {
    render(<ProblemsList problems={problems} />);
    expect(screen.queryByRole("button", { name: /Ir a/ })).toBeNull();
  });

  it("says «Sin problemas» when the list is empty", () => {
    render(<ProblemsList problems={[]} />);
    expect(screen.getByText("Sin problemas")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
