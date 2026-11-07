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
  it("has Problems, Log and Output tabs and shows the number of problems on its tab", () => {
    render(<BottomPanel problems={problems} log="registro" output="salida" />);
    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Problemas2", "Registro", "Salida"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Sesión caducada");
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

  it("collapses the bottom zone of the shell with its own button", async () => {
    const user = userEvent.setup();
    render(<AppShell bottom={<BottomPanel problems={[]} />} />);
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plegar panel" }));
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
  });
});
