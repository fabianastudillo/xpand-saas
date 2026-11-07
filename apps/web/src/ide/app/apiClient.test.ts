import { describe, expect, it, vi } from "vitest";
import { createAppClient } from "./apiClient";

function fetchJson(body: unknown, status = 200): typeof fetch {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("createAppClient (the client the app ships with)", () => {
  it("validates every response in production: a body off the contract is a schema error naming the route", async () => {
    // Arrange: the server dropped «ac_candidatos» (a drift that would otherwise crash the render).
    const client = createAppClient({ fetch: fetchJson({ barras: [], ac_existentes: [] }) });

    // Act
    const result = await client.getRed({ motor: "m", sistema: "s", tec: ["ac"] });

    // Assert
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("schema");
    expect(result.error.route).toBe("/api/red");
    expect(result.error.message).toContain("ac_candidatos");
  });

  it("delivers a conforming body as data", async () => {
    const client = createAppClient({ fetch: fetchJson({ dentro: true, local: true, nombre: "" }) });

    const result = await client.getSesion();

    expect(result).toEqual({ ok: true, data: { dentro: true, local: true, nombre: "" } });
  });
});
