import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("<Button>", () => {
  it("is a real button of type button by default", () => {
    render(<Button>Resolver</Button>);
    const button = screen.getByRole("button", { name: "Resolver" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("exposes variant and size as data attributes and defaults to secondary / md", () => {
    render(<Button>Analizar</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("primary variant paints the accent with its readable ink", () => {
    render(
      <Button variant="primary" size="sm">
        Resolver
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/bg-accent/);
    expect(button.className).toMatch(/text-accent-ink/);
    expect(button).toHaveAttribute("data-size", "sm");
  });

  it("calls onClick and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Ir</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Ir
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("asChild renders the child element with the button styles", () => {
    render(
      <Button asChild variant="ghost">
        <a href="/app/casos">Explorar casos</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Explorar casos" });
    expect(link).toHaveAttribute("data-variant", "ghost");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a visible focus style driven by the accent", () => {
    render(<Button>Foco</Button>);
    expect(screen.getByRole("button").className).toMatch(/focus-visible:outline-accent/);
  });
});
