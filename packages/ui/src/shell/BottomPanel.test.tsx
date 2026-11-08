import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { BottomPanel } from "./BottomPanel";
import type { Problem } from "./problems";

const problems: readonly Problem[] = [
  { id: "reserva", severity: "warn", title: "Reserva firme insuficiente", target: { kind: "bus", id: "2" } },
  { id: "sesion", severity: "error", title: "Sesión caducada" },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("<BottomPanel>", () => {
  it("has Problems, Log and Output tabs and says the number of problems on its tab with a separator", () => {
    render(<BottomPanel problems={problems} log="registro" output="salida" />);
    const tablist = screen.getByRole("tablist");
    expect(within(tablist).getAllByRole("tab")).toHaveLength(3);
    const problemsTab = screen.getByRole("tab", { name: "Problemas, 2" });
    expect(problemsTab).toHaveAttribute("aria-selected", "true");
    expect(within(problemsTab).getByText("2")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Sesión caducada");
  });

  it("gives the log a live log role and each panel a heading under the shell's h1", async () => {
    const user = userEvent.setup();
    render(<BottomPanel problems={[]} log="línea" />);
    expect(screen.getByRole("heading", { level: 2, name: "Problemas" }).className).toMatch(/sr-only/);
    await user.click(screen.getByRole("tab", { name: "Registro" }));
    expect(screen.getByRole("log")).toHaveTextContent("línea");
  });

  it("switches to the log and the output", async () => {
    const user = userEvent.setup();
    render(<BottomPanel problems={[]} log="línea del registro" output="salida del motor" />);
    await user.click(screen.getByRole("tab", { name: "Registro" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("línea del registro");
    await user.click(screen.getByRole("tab", { name: "Salida" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("salida del motor");
  });

  it("passes navigation through to the problems list", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BottomPanel problems={problems} onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: "Ir a barra 2" }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "bus", id: "2" });
  });

  it("can be driven from outside through tab and onTabChange", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<BottomPanel problems={[]} tab="log" onTabChange={onTabChange} log="registro" />);
    expect(screen.getByRole("tab", { name: "Registro" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Salida" }));
    expect(onTabChange).toHaveBeenCalledWith("output");
  });

  it("collapses the bottom zone of the shell with its own button and keeps its tab while hidden", async () => {
    const user = userEvent.setup();
    render(<AppShell bottom={<BottomPanel problems={[]} log="registro" />} />);
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Registro" }));
    await user.click(screen.getByRole("button", { name: "Plegar panel" }));
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.getByRole("tab", { name: "Registro" })).toHaveAttribute("aria-selected", "true");
  });
});
