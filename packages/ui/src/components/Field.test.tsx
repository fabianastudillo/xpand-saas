import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { Field } from "./Field";
import { Input } from "./Input";

afterEach(() => {
  setLocale("es");
});

describe("<Field>", () => {
  it("links the label to the control", () => {
    render(
      <Field label="Demanda">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Demanda");
    expect(input.tagName).toBe("INPUT");
  });

  it("describes the control with the hint", () => {
    render(
      <Field label="Demanda" hint="En MW, por barra">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Demanda");
    const hint = screen.getByText("En MW, por barra");
    expect(input.getAttribute("aria-describedby")).toContain(hint.id);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and announces the error before the hint", () => {
    render(
      <Field label="Demanda" hint="En MW" error="Debe ser mayor que 0">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Demanda");
    const error = screen.getByText("Debe ser mayor que 0");
    const hint = screen.getByText("En MW");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(error).toHaveAttribute("role", "alert");
    expect(input.getAttribute("aria-describedby")).toBe(`${error.id} ${hint.id}`);
  });

  it("merges a description the control already carries instead of overriding it", () => {
    render(
      <>
        <p id="unidad">En MW</p>
        <Field label="Demanda" error="Debe ser mayor que 0">
          <Input aria-describedby="unidad" />
        </Field>
      </>,
    );
    const input = screen.getByLabelText("Demanda");
    const error = screen.getByText("Debe ser mayor que 0");
    expect(input.getAttribute("aria-describedby")).toBe(`${error.id} unidad`);
  });

  it("shows «Obligatorio» next to the label and sets aria-required", () => {
    render(
      <Field label="Sistema" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Sistema/);
    expect(input).toHaveAttribute("aria-required", "true");
    const mark = screen.getByText("Obligatorio");
    expect(mark.className).toMatch(/text-ink-muted/);
    expect(screen.queryByText("*")).toBeNull();

    act(() => {
      setLocale("en");
    });
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("keeps aria-invalid and aria-required the control already carries when the Field says nothing", () => {
    render(
      <Field label="Demanda">
        <Input aria-invalid aria-required />
      </Field>,
    );
    const input = screen.getByLabelText("Demanda");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("honours an explicit id on the Field and one the control already has", () => {
    const { unmount } = render(
      <Field label="Horizonte" id="horizonte">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Horizonte")).toHaveAttribute("id", "horizonte");
    unmount();

    render(
      <Field label="Solver">
        <Input id="solver" />
      </Field>,
    );
    expect(screen.getByLabelText("Solver")).toHaveAttribute("id", "solver");
  });
});

describe("<Input>", () => {
  it("uses the monospaced font when mono is set", () => {
    render(<Input mono aria-label="Pd" />);
    expect(screen.getByLabelText("Pd").className).toMatch(/font-mono/);
  });

  it("keeps the error border while focused", () => {
    render(<Input aria-label="Pd" aria-invalid />);
    expect(screen.getByLabelText("Pd").className).toMatch(/aria-invalid:focus-visible:border-error/);
  });
});
