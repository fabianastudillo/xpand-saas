import { describe, expect, it } from "vitest";
import catalogoExample from "../../../contracts/api/examples/catalogo.json";
import configExample from "../../../contracts/api/examples/config.json";
import redExample from "../../../contracts/api/examples/red.json";
import sesionExample from "../../../contracts/api/examples/sesion.json";
import { createSchemaValidator } from "./validate";

const validator = createSchemaValidator();

const redValida = {
  barras: [{ id: "1", nombre: "1", kv: 0, pd: 80, qd: 24, vmin: 0.95, vmax: 1.05 }],
  ac_existentes: [{ id: "1-2", de: "1", a: "2", r: 0.1, x: 0.4, s: 40 }],
  ac_candidatos: [{ id: "1-3", de: "1", a: "3", r: 0.1, x: 0.4, s: 40, costo: 10, nmax: 4 }],
};

describe("createSchemaValidator: ejemplos del contrato", () => {
  it.each([
    ["catalogo", catalogoExample],
    ["red", redExample],
    ["config", configExample],
    ["sesion", sesionExample],
  ] as const)("acepta el ejemplo de %s", (nombre, ejemplo) => {
    expect(validator.check(nombre, ejemplo)).toBeUndefined();
  });

  it("acepta campos extra en la raíz de la respuesta", () => {
    expect(validator.check("red", { ...redValida, extra: "servidor nuevo" })).toBeUndefined();
  });
});

describe("createSchemaValidator: rechazos", () => {
  it("nombra el campo requerido que falta", () => {
    const sinCandidatos = Object.fromEntries(
      Object.entries(redValida).filter(([clave]) => clave !== "ac_candidatos"),
    );

    const mensaje = validator.check("red", sinCandidatos);

    expect(mensaje).toContain("ac_candidatos");
  });

  it("rechaza un identificador de barra numérico (de y a son cadenas)", () => {
    const red = { ...redValida, ac_existentes: [{ id: "1-2", de: 1, a: "2", r: 0, x: 0, s: 0 }] };

    expect(validator.check("red", red)).toContain("de");
  });

  it("rechaza un costo negativo en líneas candidatas", () => {
    const red = {
      ...redValida,
      ac_candidatos: [{ id: "x", de: "1", a: "2", r: 0, x: 0, s: 0, costo: -1, nmax: 1 }],
    };

    expect(validator.check("red", red)).toBeDefined();
  });

  it("rechaza un motor sin formulacion ni familia", () => {
    const catalogo = { motores: [{ id: "jump_misocp", nombre: "MISOCP", sistemas: [] }] };

    expect(validator.check("catalogo", catalogo)).toBeDefined();
  });

  it("acepta un motor con familia en lugar de formulacion", () => {
    const catalogo = { motores: [{ id: "fp_dc", nombre: "FP", familia: "convexo", sistemas: [] }] };

    expect(validator.check("catalogo", catalogo)).toBeUndefined();
  });

  it("rechaza barras negativas en un sistema", () => {
    const catalogo = {
      motores: [
        { id: "m", nombre: "M", formulacion: "f", sistemas: [{ id: "s", nombre: "S", barras: -1 }] },
      ],
    };

    expect(validator.check("catalogo", catalogo)).toBeDefined();
  });

  it("rechaza una referencia cuyo valor no es numérico", () => {
    const catalogo = {
      motores: [
        {
          id: "m",
          nombre: "M",
          formulacion: "f",
          sistemas: [{ id: "s", nombre: "S", barras: 6, referencias: [{ valor: "6212" }] }],
        },
      ],
    };

    expect(validator.check("catalogo", catalogo)).toBeDefined();
  });

  it("rechaza una config sin version", () => {
    expect(validator.check("config", { cupo: {} })).toContain("version");
  });

  it("rechaza una sesión sin el campo local", () => {
    expect(validator.check("sesion", { dentro: true, nombre: "x" })).toContain("local");
  });

  it("rechaza un cuerpo que no es objeto", () => {
    expect(validator.check("red", null)).toBeDefined();
    expect(validator.check("catalogo", "texto")).toBeDefined();
  });
});
