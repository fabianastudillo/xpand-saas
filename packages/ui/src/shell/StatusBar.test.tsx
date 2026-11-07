import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { StatusBar } from "./StatusBar";
import type { Problem } from "./problems";

const problems: readonly Problem[] = [
  { id: "a", severity: "error", title: "Sesión caducada" },
  { id: "b", severity: "warn", title: "Reserva firme" },
  { id: "c", severity: "warn", title: "Tensión" },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("<StatusBar>", () => {
  it("announces the message in a live status region", () => {
    render(<StatusBar message="Catálogo cargado" />);
    expect(screen.getByRole("status")).toHaveTextContent("Catálogo cargado");
  });

  it("summarises the problems in words, with text for each severity", () => {
    render(<StatusBar problems={problems} />);
    const summary = screen.getByRole("button", { name: "1 error, 2 avisos" });
    expect(summary).toBeInTheDocument();
  });

  it("says «Sin problemas» when the list is empty", () => {
    render(<StatusBar problems={[]} />);
    expect(screen.getByText("Sin problemas")).toBeInTheDocument();
  });

  it("opens the bottom panel when the problems summary is activated", async () => {
    const user = userEvent.setup();
    render(<AppShell bottom={<span>panel</span>} status={<StatusBar problems={problems} />} />);
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "1 error, 2 avisos" }));
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
  });

  it("renders extra content on the right", () => {
    render(<StatusBar>Español</StatusBar>);
    expect(screen.getByText("Español")).toBeInTheDocument();
  });
});
