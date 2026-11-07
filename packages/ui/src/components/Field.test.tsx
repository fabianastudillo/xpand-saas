import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";

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

  it("marks the control invalid and describes it with the error", () => {
    render(
      <Field label="Demanda" hint="En MW" error="Debe ser mayor que 0">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Demanda");
    const error = screen.getByText("Debe ser mayor que 0");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByText("En MW").id);
  });

  it("announces required fields to assistive technology and shows a mark", () => {
    render(
      <Field label="Sistema" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Sistema/);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("honours an explicit id", () => {
    render(
      <Field label="Horizonte" id="horizonte">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Horizonte")).toHaveAttribute("id", "horizonte");
  });
});

describe("<Input>", () => {
  it("uses the monospaced font when mono is set", () => {
    render(<Input mono aria-label="Pd" />);
    expect(screen.getByLabelText("Pd").className).toMatch(/font-mono/);
  });
});
