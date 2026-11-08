import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Tooltip, TooltipProvider } from "./Tooltip";

describe("<Tooltip>", () => {
  it("shows its content when the trigger receives focus", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Resuelve el plan con el método elegido">
          <Button>Resolver</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Resuelve el plan con el método elegido");
  });

  it("renders a keyboard shortcut as <kbd> keys", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Paleta de comandos" shortcut="Ctrl+K">
          <Button>Buscar</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    const keys = document.querySelectorAll('[data-slot="tooltip"] kbd');
    expect([...keys].map((k) => k.textContent)).toEqual(["Ctrl", "K"]);
  });

  it("exposes the shortcut on the trigger as aria-keyshortcuts with ARIA key names", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Paleta de comandos" shortcut="Ctrl+K">
          <Button>Buscar</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-keyshortcuts", "Control+K");
  });

  it("does not add aria-keyshortcuts without a shortcut", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Ayuda">
          <Button>Ayuda</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-keyshortcuts");
  });

  it("works on a button disabled with a reason: the trigger is still focusable", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Elige un sistema antes de resolver">
          <Button aria-disabled>Resolver</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Elige un sistema antes de resolver");
  });
});
