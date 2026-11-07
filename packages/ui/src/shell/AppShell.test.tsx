import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, useShellLayout } from "./AppShell";

function Toggles(): React.JSX.Element {
  const layout = useShellLayout();
  return (
    <div>
      <button type="button" onClick={layout.left.toggle} aria-expanded={layout.left.open}>
        Explorador (hijo)
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

const leftZone = (): HTMLElement | null => screen.queryByRole("complementary", { name: "Explorador del caso" });
const rightZone = (): HTMLElement | null => screen.queryByRole("complementary", { name: "Inspector" });
const bottomZone = (): HTMLElement | null => screen.queryByRole("region", { name: "Panel inferior" });

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
    expect(leftZone()).toHaveTextContent("árbol");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(rightZone()).toHaveTextContent("inspector");
    expect(bottomZone()).toHaveTextContent("problemas");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("listo");
  });

  it("Ctrl+B, Ctrl+I and Ctrl+J hide and show the left, right and bottom zones, keeping them mounted", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.keyboard("{Control>}b{/Control}");
    expect(leftZone()).toBeNull();
    const hiddenLeft = screen.getByTestId("shell-left"); // data-slot; a hidden element has no accessible name
    expect(hiddenLeft).toHaveAttribute("hidden");
    expect(hiddenLeft).toHaveAttribute("inert");
    expect(hiddenLeft).toHaveTextContent("árbol");
    await user.keyboard("{Control>}i{/Control}");
    expect(rightZone()).toBeNull();
    await user.keyboard("{Control>}j{/Control}");
    expect(bottomZone()).toBeNull();
    await user.keyboard("{Control>}b{/Control}{Control>}i{/Control}{Control>}j{/Control}");
    expect(leftZone()).toBeInTheDocument();
    expect(rightZone()).toBeInTheDocument();
    expect(bottomZone()).toBeInTheDocument();
  });

  it("leaves the shortcuts to the text field while typing", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByLabelText("Nombre"));
    await user.keyboard("{Control>}b{/Control}{Control>}i{/Control}{Control>}j{/Control}");
    expect(leftZone()).toBeInTheDocument();
    expect(rightZone()).toBeInTheDocument();
    expect(bottomZone()).toBeInTheDocument();
  });

  it("keeps the bottom panel collapsed after remounting", async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await user.keyboard("{Control>}j{/Control}");
    expect(bottomZone()).toBeNull();
    first.unmount();

    renderShell();
    expect(bottomZone()).toBeNull();
    expect(leftZone()).toBeInTheDocument();
  });

  it("exposes the layout to its children through useShellLayout", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Explorador (hijo)" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(leftZone()).toBeNull();
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
    expect(bottomZone()).toBeInTheDocument();
    await user.keyboard("{Control>}j{/Control}");
    expect(bottomZone()).toBeNull();
  });

  it("omits the zones it was not given and says so in the layout", () => {
    render(<AppShell center={<Toggles />} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { hidden: true })).toBeNull();
    expect(screen.queryByRole("region", { hidden: true })).toBeNull();
  });

  it("does not run the zone shortcuts while another modal dialog is open", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        left={<span>árbol</span>}
        center={
          <div role="dialog" aria-modal="true" aria-label="Confirmar">
            <button type="button">Sí</button>
          </div>
        }
      />,
    );
    await user.click(screen.getByRole("button", { name: "Sí" }));
    await user.keyboard("{Control>}b{/Control}");
    expect(leftZone()).toBeInTheDocument();
  });
});
