import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { Badge } from "./Badge";

afterEach(() => {
  setLocale("es");
});

describe("<Badge>", () => {
  it('tone="uncertified" always shows NO CERTIFICADO in Spanish', () => {
    render(<Badge tone="uncertified" />);
    expect(screen.getByText("NO CERTIFICADO")).toBeTruthy();
  });

  it('tone="uncertified" follows the locale (NOT CERTIFIED in English)', () => {
    render(<Badge tone="uncertified" />);
    act(() => {
      setLocale("en");
    });
    expect(screen.getByText("NOT CERTIFIED")).toBeTruthy();
  });

  it('tone="uncertified" ignores any children: the text cannot be replaced or softened', () => {
    // The prop type forbids children; a caller bypassing the types still gets the honest label.
    const Loose = Badge as unknown as (props: { tone: string; children?: string }) => React.JSX.Element;
    render(<Loose tone="uncertified">ok</Loose>);
    expect(screen.getByText("NO CERTIFICADO")).toBeTruthy();
    expect(screen.queryByText("ok")).toBeNull();
  });

  it('tone="ac-feasible" always shows «Factible en AC»', () => {
    render(<Badge tone="ac-feasible" />);
    expect(screen.getByText("Factible en AC")).toBeTruthy();
  });

  it('tone="certified" shows «Certificado» by default and accepts a more specific label', () => {
    const { unmount } = render(<Badge tone="certified" />);
    expect(screen.getByText("Certificado")).toBeTruthy();
    unmount();
    render(<Badge tone="certified">Certificado AC</Badge>);
    expect(screen.getByText("Certificado AC")).toBeTruthy();
  });

  it("neutral, warn and error render their children and expose the tone", () => {
    render(
      <>
        <Badge tone="neutral">MISOCP</Badge>
        <Badge tone="warn">Reserva baja</Badge>
        <Badge tone="error">Infactible</Badge>
      </>,
    );
    expect(screen.getByText("MISOCP")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByText("Reserva baja")).toHaveAttribute("data-tone", "warn");
    expect(screen.getByText("Infactible")).toHaveAttribute("data-tone", "error");
  });

  it("uncertified uses the error colors, never a softer tone", () => {
    render(<Badge tone="uncertified" />);
    const badge = screen.getByText("NO CERTIFICADO");
    expect(badge).toHaveAttribute("data-tone", "uncertified");
    expect(badge.className).toMatch(/bg-error-bg/);
    expect(badge.className).toMatch(/text-error-ink/);
  });
});
