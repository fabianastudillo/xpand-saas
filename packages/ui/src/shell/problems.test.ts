import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { countBySeverity, createProblemsStore, useProblems, type Problem } from "./problems";

const reserve: Problem = {
  id: "reserva",
  severity: "warn",
  title: "Reserva firme insuficiente",
  cause: "1140 MW de 1457,8 MW exigidos",
  source: "plan",
};
const session: Problem = { id: "sesion", severity: "error", title: "Sesión caducada", source: "api" };

describe("createProblemsStore", () => {
  it("adds, replaces by id and removes immutably", () => {
    const store = createProblemsStore();
    const before = store.getList();
    store.add(reserve);
    expect(store.getList()).toHaveLength(1);
    expect(before).toHaveLength(0);

    store.add({ ...reserve, title: "Reserva firme insuficiente (2)" });
    expect(store.getList()).toHaveLength(1);
    expect(store.getList()[0]?.title).toBe("Reserva firme insuficiente (2)");

    store.remove("reserva");
    expect(store.getList()).toHaveLength(0);
  });

  it("clears only the given source, or everything when no source is given", () => {
    const store = createProblemsStore([reserve, session]);
    store.clear("api");
    expect(store.getList().map((problem) => problem.id)).toEqual(["reserva"]);
    store.add(session);
    store.clear();
    expect(store.getList()).toHaveLength(0);
  });

  it("notifies subscribers once per change and stops after unsubscribe", () => {
    const store = createProblemsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.add(reserve);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.remove("reserva");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("useProblems", () => {
  it("re-renders with the list and keeps stable action references", () => {
    const store = createProblemsStore();
    const { result } = renderHook(() => useProblems(store));
    const first = result.current;
    expect(first.list).toHaveLength(0);

    act(() => {
      first.add(session);
    });
    expect(result.current.list).toHaveLength(1);
    expect(result.current.add).toBe(first.add);
    expect(result.current.remove).toBe(first.remove);
    expect(result.current.clear).toBe(first.clear);

    act(() => {
      result.current.clear("api");
    });
    expect(result.current.list).toHaveLength(0);
  });
});

describe("countBySeverity", () => {
  it("counts every severity, with zeros for the absent ones", () => {
    expect(countBySeverity([reserve, session, { ...session, id: "otro" }])).toEqual({ error: 2, warn: 1, info: 0 });
  });
});
