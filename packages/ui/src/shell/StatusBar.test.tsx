import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { BottomPanel } from "./BottomPanel";
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

  it("shows progress (timers, counters) next to the message without announcing it", () => {
    render(<StatusBar message="Resolviendo" progress="12 s" />);
    const progress = screen.getByText("12 s");
    expect(progress).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).not.toContainElement(progress);
  });

  it("summarises the problems in words, with text for each severity", () => {
    render(<StatusBar problems={problems} />);
    expect(screen.getByRole("button", { name: "1 error, 2 avisos" })).toBeInTheDocument();
  });

  it("keeps the button, saying «Sin problemas», when the list is empty", () => {
    render(<StatusBar problems={[]} />);
    expect(screen.getByRole("button", { name: "Sin problemas" })).toBeInTheDocument();
  });

  it("toggles the bottom panel: closed → opens on Problems; on Log → selects Problems; on Problems → closes", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        bottom={<BottomPanel problems={problems} log="registro" />}
        status={<StatusBar problems={problems} />}
      />,
    );
    const summary = screen.getByRole("button", { name: "1 error, 2 avisos" });
    const panel = screen.getByRole("region", { name: "Panel inferior" });
    expect(summary).toHaveAttribute("aria-controls", panel.id);

    await user.click(screen.getByRole("tab", { name: "Registro" }));
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    expect(summary).toHaveAttribute("aria-expanded", "false");

    await user.click(summary);
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Problemas/ })).toHaveAttribute("aria-selected", "true");
    expect(summary).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("tab", { name: "Registro" }));
    await user.click(summary);
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Problemas/ })).toHaveAttribute("aria-selected", "true");

    await user.click(summary);
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
  });

  it("renders extra content on the right", () => {
    render(<StatusBar>Español</StatusBar>);
    expect(screen.getByText("Español")).toBeInTheDocument();
  });
});
