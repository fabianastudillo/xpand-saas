import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

type Listener = (event: { matches: boolean }) => void;

/** A matchMedia stub: `narrow` sets what the shell's breakpoint query answers; `change(…)` flips it live. */
function mockMatchMedia(narrow: boolean): { change: (matches: boolean) => void } {
  const listeners = new Set<Listener>();
  const state = { matches: narrow };
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return state.matches;
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }));
  return {
    change: (matches) => {
      state.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const leftZone = (): HTMLElement | null => screen.queryByRole("complementary", { name: "Explorador del caso" });

describe("<AppShell> below the reflow breakpoint", () => {
  it("starts with the side zones collapsed and opens them as drawers that Escape closes", async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(
      <AppShell
        left={<button type="button">Dentro</button>}
        center={<button type="button">Centro</button>}
        right={<span>inspector</span>}
        bottom={<span>problemas</span>}
      />,
    );
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-narrow", "true");
    expect(leftZone()).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Inspector" })).toBeNull();
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Centro" }));
    await user.keyboard("{Control>}b{/Control}");
    const left = leftZone();
    expect(left).toHaveAttribute("data-mode", "drawer");
    expect(screen.getByRole("button", { name: "Dentro" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(leftZone()).toBeNull();
    expect(screen.getByRole("button", { name: "Centro" })).toHaveFocus();
  });

  it("does not persist the collapsed state that the breakpoint forced", async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<AppShell left={<span>árbol</span>} center={<p>c</p>} />);
    await user.keyboard("{Control>}b{/Control}{Control>}b{/Control}");
    expect(window.localStorage.getItem("xpand.shell.left")).toBeNull();
  });

  it("closes the drawers when the viewport becomes narrow, and restores the desktop state when it widens", () => {
    const media = mockMatchMedia(false);
    render(<AppShell left={<span>árbol</span>} center={<p>c</p>} />);
    expect(leftZone()).toBeInTheDocument();
    act(() => {
      media.change(true);
    });
    expect(leftZone()).toBeNull();
    act(() => {
      media.change(false);
    });
    expect(leftZone()).toBeInTheDocument();
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-narrow", "false");
  });

  it("lets the page scroll and caps the bottom panel height when narrow", () => {
    mockMatchMedia(true);
    render(<AppShell center={<p>c</p>} bottom={<span>problemas</span>} />);
    expect(screen.getByTestId("app-shell").className).toMatch(/min-h-dvh/);
    expect(screen.getByRole("region", { name: "Panel inferior" }).className).toMatch(/max-h-\[40dvh\]/);
  });
});
