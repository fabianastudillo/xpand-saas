import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, useShellLayout } from "./AppShell";

function Toggles(): React.JSX.Element {
  const layout = useShellLayout();
  return (
    <div>
      <button type="button" onClick={layout.left.toggle} aria-expanded={layout.left.open}>
        Explorador
      </button>
      <input aria-label="Nombre" />
    </div>
  );
}

function renderShell(): ReturnType<typeof render> {
  return render(
    <AppShell
      top={<span>barra superior</span>}
      left={<span>árbol</span>}
      center={<Toggles />}
      right={<span>inspector</span>}
      bottom={<span>problemas</span>}
      status={<span>listo</span>}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<AppShell>", () => {
  it("renders the six zones as landmarks with distinct names", () => {
    renderShell();
    expect(screen.getByRole("banner")).toHaveTextContent("barra superior");
    expect(screen.getByRole("complementary", { name: "Explorador del caso" })).toHaveTextContent("árbol");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toHaveTextContent("inspector");
    expect(screen.getByRole("region", { name: "Panel inferior" })).toHaveTextContent("problemas");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("listo");
  });

  it("Ctrl+B, Ctrl+I and Ctrl+J toggle the left, right and bottom zones", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.keyboard("{Control>}b{/Control}");
    expect(screen.queryByRole("complementary", { name: "Explorador del caso" })).toBeNull();
    await user.keyboard("{Control>}i{/Control}");
    expect(screen.queryByRole("complementary", { name: "Inspector" })).toBeNull();
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    await user.keyboard("{Control>}b{/Control}{Control>}i{/Control}{Control>}j{/Control}");
    expect(screen.getByRole("complementary", { name: "Explorador del caso" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
  });

  it("leaves the shortcuts to the text field while typing", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByLabelText("Nombre"));
    await user.keyboard("{Control>}b{/Control}{Control>}i{/Control}{Control>}j{/Control}");
    expect(screen.getByRole("complementary", { name: "Explorador del caso" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
  });

  it("keeps the bottom panel collapsed after remounting", async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    first.unmount();

    renderShell();
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
    expect(screen.getByRole("complementary", { name: "Explorador del caso" })).toBeInTheDocument();
  });

  it("exposes the layout to its children through useShellLayout", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Explorador" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("complementary", { name: "Explorador del caso" })).toBeNull();
  });

  it("still works when localStorage is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    renderShell();
    expect(screen.getByRole("region", { name: "Panel inferior" })).toBeInTheDocument();
    await user.keyboard("{Control>}j{/Control}");
    expect(screen.queryByRole("region", { name: "Panel inferior" })).toBeNull();
  });

  it("omits the zones it was not given", () => {
    render(<AppShell center={<span>solo centro</span>} />);
    expect(screen.getByRole("main")).toHaveTextContent("solo centro");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
