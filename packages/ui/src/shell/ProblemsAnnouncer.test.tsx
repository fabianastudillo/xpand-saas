import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { ProblemsAnnouncer } from "./ProblemsAnnouncer";
import { createProblemsStore } from "./problems";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<ProblemsAnnouncer>", () => {
  it("is an always-mounted polite status region that stays silent on the initial load", () => {
    const store = createProblemsStore([{ id: "old", severity: "error", title: "Sesión caducada" }]);
    render(<ProblemsAnnouncer store={store} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.className).toMatch(/sr-only/);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(region).toHaveTextContent("");
  });

  it("announces a new error after the debounce, batching several into one message", () => {
    const store = createProblemsStore();
    render(<ProblemsAnnouncer store={store} />);
    act(() => {
      store.add({ id: "a", severity: "error", title: "Sesión caducada" });
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Error: Sesión caducada");

    act(() => {
      store.add({ id: "b", severity: "error", title: "Servidor caído" });
      store.add({ id: "c", severity: "error", title: "Caso no encontrado" });
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("status")).toHaveTextContent("2 errores nuevos");
  });

  it("ignores warnings, information and replacements of an existing id", () => {
    const store = createProblemsStore([{ id: "a", severity: "error", title: "Sesión caducada" }]);
    render(<ProblemsAnnouncer store={store} />);
    act(() => {
      store.add({ id: "w", severity: "warn", title: "Reserva" });
      store.add({ id: "a", severity: "error", title: "Sesión caducada (otra vez)" });
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
