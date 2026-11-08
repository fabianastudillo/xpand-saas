import { beforeEach, describe, expect, it, vi } from "vitest";
import configExample from "../../../contracts/api/examples/config.json";
import { createClient } from "./client";
import { jsonResponse } from "./test-utils";

// The validator module is replaced so its loading and checking can be made to fail.
const { createSchemaValidator } = vi.hoisted(() => ({ createSchemaValidator: vi.fn() }));
vi.mock("./validate", () => ({ createSchemaValidator }));

const acceptingValidator = { check: () => undefined };

// A fresh Response per call: a Response body can only be read once.
function fetchJson(body: unknown) {
  return vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(body)));
}

beforeEach(() => {
  createSchemaValidator.mockReset();
  createSchemaValidator.mockReturnValue(acceptingValidator);
});

describe("createClient: fallos del validador", () => {
  it("si cargar el validador lanza, la llamada devuelve schema y no rechaza", async () => {
    createSchemaValidator.mockImplementationOnce(() => {
      throw new Error("ajv: cannot compile");
    });
    const client = createClient({ fetch: fetchJson(configExample), validate: true });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "schema", route: "/api/config" });
    expect(result.error.message).toContain("ajv: cannot compile");
  });

  it("tras un fallo al cargar, la siguiente llamada vuelve a intentar la carga y funciona", async () => {
    createSchemaValidator.mockImplementationOnce(() => {
      throw new Error("chunk failed to load");
    });
    const client = createClient({ fetch: fetchJson(configExample), validate: true });

    await client.getConfig();
    const segunda = await client.getConfig();

    expect(createSchemaValidator).toHaveBeenCalledTimes(2);
    expect(segunda.ok).toBe(true);
  });

  it("si validar el cuerpo lanza, la llamada devuelve schema y no rechaza", async () => {
    createSchemaValidator.mockReturnValue({
      check: () => {
        throw new Error("validator exploded");
      },
    });
    const client = createClient({ fetch: fetchJson(configExample), validate: true });

    const result = await client.getConfig();

    expect(result).toMatchObject({ ok: false, error: { kind: "schema", route: "/api/config" } });
  });
});
