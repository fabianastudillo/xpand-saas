import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

/** A consumer whose actions remove their own problem (a retry that succeeds). */
function SelfClearing(): React.JSX.Element {
  const [list, setList] = useState<readonly Problem[]>(() =>
    ["a", "b", "c"].map((id) => ({
      id,
      severity: "error",
      title: `Error ${id}`,
      action: { label: "Reintentar", run: () => { setList((current) => current.filter((p) => p.id !== id)); } },
    })),
  );
  return <ProblemsList problems={list} />;
}

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
    expect(item.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders the cause under the title", () => {
    render(<ProblemsList problems={[problems[0] as Problem]} />);
    expect(screen.getByText("1140 MW de 1457,8 MW exigidos")).toBeInTheDocument();
  });

  it("shows the action of a problem as a button, runs it with no arguments, and describes it by the title", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <ProblemsList
        problems={[
          { id: "sesion", severity: "error", title: "Sesión caducada", action: { label: "Reintentar", run } },
          { id: "red", severity: "error", title: "Red no cargada", action: { label: "Reintentar", run: vi.fn() } },
        ]}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Reintentar" });
    expect(buttons).toHaveLength(2);
    const described = document.getElementById(buttons[0]?.getAttribute("aria-describedby") ?? "");
    expect(described).toHaveTextContent("Sesión caducada");
    await user.click(buttons[0] as HTMLElement);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith();
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

  it("moves the focus to the next problem's action when the activated one disappears, then to the list", async () => {
    const user = userEvent.setup();
    render(<SelfClearing />);
    const [first] = screen.getAllByRole("button", { name: "Reintentar" });
    await user.click(first as HTMLElement);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const [next] = screen.getAllByRole("button", { name: "Reintentar" });
    expect(next).toHaveFocus();
    await user.click(next as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByText("Sin problemas")).toHaveFocus();
  });

  it("does not steal the focus when the problem disappears later and the user has moved on", async () => {
    const user = userEvent.setup();
    function Async(): React.JSX.Element {
      const [list, setList] = useState<readonly Problem[]>([
        { id: "a", severity: "error", title: "Error a", action: { label: "Reintentar", run: () => {} } },
        { id: "b", severity: "error", title: "Error b", action: { label: "Reintentar", run: () => {} } },
      ]);
      return (
        <div>
          <ProblemsList problems={list} />
          <button type="button" onClick={() => { setList((current) => current.filter((p) => p.id !== "a")); }}>
            Resuelto
          </button>
        </div>
      );
    }
    render(<Async />);
    const [first] = screen.getAllByRole("button", { name: "Reintentar" });
    await user.click(first as HTMLElement); // the retry is asynchronous: nothing changes yet
    const outside = screen.getByRole("button", { name: "Resuelto" });
    await user.click(outside); // the problem disappears while the focus is elsewhere
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(outside).toHaveFocus();
  });

  it("says «Sin problemas» when the list is empty", () => {
    render(<ProblemsList problems={[]} />);
    expect(screen.getByText("Sin problemas")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
