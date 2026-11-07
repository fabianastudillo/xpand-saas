import { describe, expect, it, vi } from "vitest";
import catalogoExample from "../../../contracts/api/examples/catalogo.json";
import configExample from "../../../contracts/api/examples/config.json";
import redExample from "../../../contracts/api/examples/red.json";
import sesionExample from "../../../contracts/api/examples/sesion.json";
import { createClient } from "./client";
import { jsonResponse, urlOf } from "./test-utils";

function fetchReturning(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

function requestedUrl(fetchMock: ReturnType<typeof fetchReturning>): string {
  const [input] = fetchMock.mock.calls[0] ?? [];
  return urlOf(input ?? "");
}

describe("createClient: respuestas correctas", () => {
  it("devuelve ok con los datos cuando el cuerpo 200 es válido", async () => {
    // Arrange
    const fetchMock = fetchReturning(jsonResponse(catalogoExample));
    const client = createClient({ fetch: fetchMock, validate: true });

    // Act
    const result = await client.getCatalogo();

    // Assert
    expect(result).toEqual({ ok: true, data: catalogoExample });
  });

  it("pide las rutas relativas /api/* cuando no hay baseUrl", async () => {
    const fetchMock = fetchReturning(jsonResponse(configExample));
    const client = createClient({ fetch: fetchMock });

    await client.getConfig();

    expect(requestedUrl(fetchMock)).toBe("/api/config");
  });

  it("antepone baseUrl a cada ruta", async () => {
    const fetchMock = fetchReturning(jsonResponse(sesionExample));
    const client = createClient({ baseUrl: "http://127.0.0.1:8850", fetch: fetchMock });

    await client.getSesion();

    expect(requestedUrl(fetchMock)).toBe("http://127.0.0.1:8850/api/sesion");
  });

  it("sin validate no comprueba el esquema y entrega el cuerpo tal cual", async () => {
    const cuerpoInvalido = { dentro: "si" };
    const fetchMock = fetchReturning(jsonResponse(cuerpoInvalido));
    const client = createClient({ fetch: fetchMock });

    const result = await client.getSesion();

    expect(result).toEqual({ ok: true, data: cuerpoInvalido });
  });

  it.each([
    ["getCatalogo", "/api/catalogo", catalogoExample],
    ["getConfig", "/api/config", configExample],
    ["getSesion", "/api/sesion", sesionExample],
  ] as const)("%s pide %s y acepta el ejemplo del contrato con validate", async (metodo, ruta, ejemplo) => {
    const fetchMock = fetchReturning(jsonResponse(ejemplo));
    const client = createClient({ fetch: fetchMock, validate: true });

    const result = await client[metodo]();

    expect(requestedUrl(fetchMock)).toBe(ruta);
    expect(result.ok).toBe(true);
  });
});

describe("createClient: codificación de getRed", () => {
  it("codifica motor, sistema y tec exactamente como la consulta esperada", async () => {
    const fetchMock = fetchReturning(jsonResponse(redExample));
    const client = createClient({ fetch: fetchMock });

    await client.getRed({ motor: "jump_misocp", sistema: "SNI año/2032 ñ", tec: ["ac", "sssc"] });

    expect(requestedUrl(fetchMock)).toBe(
      "/api/red?motor=jump_misocp&sistema=SNI%20a%C3%B1o%2F2032%20%C3%B1&tec=ac%2Csssc",
    );
  });

  it("no usa + para los espacios", async () => {
    const fetchMock = fetchReturning(jsonResponse(redExample));
    const client = createClient({ fetch: fetchMock });

    await client.getRed({ motor: "jump_misocp", sistema: "a b", tec: ["ac"] });

    expect(requestedUrl(fetchMock)).not.toContain("+");
  });

  it("conserva el identificador al decodificar la consulta en el servidor", async () => {
    const sistema = "SNI año/2032 ñ & 50% #1";
    const fetchMock = fetchReturning(jsonResponse(redExample));
    const client = createClient({ fetch: fetchMock });

    await client.getRed({ motor: "jump_misocp", sistema, tec: ["ac"] });

    const parametros = new URL(requestedUrl(fetchMock), "http://localhost").searchParams;
    expect(parametros.get("sistema")).toBe(sistema);
  });

  it("envía tec vacío como consulta vacía sin lanzar", async () => {
    const fetchMock = fetchReturning(jsonResponse(redExample));
    const client = createClient({ fetch: fetchMock });

    await client.getRed({ motor: "jump_misocp", sistema: "tnep_garver6", tec: [] });

    expect(requestedUrl(fetchMock)).toBe("/api/red?motor=jump_misocp&sistema=tnep_garver6&tec=");
  });

  it("acepta el ejemplo de red del contrato con validate", async () => {
    const fetchMock = fetchReturning(jsonResponse(redExample));
    const client = createClient({ fetch: fetchMock, validate: true });

    const result = await client.getRed({ motor: "jump_misocp", sistema: "tnep_garver6", tec: ["ac"] });

    expect(result.ok).toBe(true);
  });

  it("acepta la red del motor «real» (ids enteros, barras sin nombre) y entrega los ids como cadenas", async () => {
    // Arrange: the shape that red_real emits (contracts/api/red.schema.json admits it; the UI reads strings).
    const redReal = {
      barras: [{ id: 1, etiqueta: "Subestación A", kv: 230, pd: 10, qd: 2, vmin: 0.95, vmax: 1.05 }],
      ac_existentes: [{ id: "L1_230", de: 1, a: 2, r: 0.01, x: 0.1, s: 300 }],
      ac_candidatos: [{ id: "C1_230", de: 2, a: 1, r: 0.01, x: 0.1, s: 300, costo: 12.5, nmax: 2 }],
    };
    const client = createClient({ fetch: fetchReturning(jsonResponse(redReal)), validate: true });

    // Act
    const result = await client.getRed({ motor: "real", sistema: "sni", tec: ["ac"] });

    // Assert
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.barras[0]).toMatchObject({ id: "1", etiqueta: "Subestación A" });
    expect(result.data.barras[0]?.nombre).toBeUndefined();
    expect(result.data.ac_existentes[0]).toMatchObject({ de: "1", a: "2" });
    expect(result.data.ac_candidatos[0]).toMatchObject({ de: "2", a: "1" });
  });
});

describe("createClient: errores explícitos", () => {
  it("401 se reporta como auth con su estado", async () => {
    const client = createClient({ fetch: fetchReturning(jsonResponse({ error: "no" }, 401)) });

    const result = await client.getSesion();

    expect(result).toEqual({
      ok: false,
      error: { kind: "auth", status: 401, route: "/api/sesion", message: expect.any(String) as string },
    });
  });

  it("403 se reporta como auth", async () => {
    const client = createClient({ fetch: fetchReturning(jsonResponse({}, 403)) });

    const result = await client.getCatalogo();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "auth", status: 403, route: "/api/catalogo" });
  });

  it("500 se reporta como http con el estado", async () => {
    const client = createClient({ fetch: fetchReturning(jsonResponse({}, 500)) });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "http", status: 500, route: "/api/config" });
    expect(result.error.message).not.toBe("");
  });

  it("un error con la forma única del servidor conserva su código", async () => {
    const cuerpo = { error: { codigo: "caso_no_encontrado", mensaje: "No existe el caso pedido." } };
    const client = createClient({ fetch: fetchReturning(jsonResponse(cuerpo, 404)) });

    const result = await client.getRed({ motor: "m", sistema: "s", tec: ["ac"] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "http", status: 404, route: "/api/red", code: "caso_no_encontrado" });
  });

  it("el código también llega con 503 y con 401", async () => {
    const unavailable = { error: { codigo: "almacen_no_disponible", mensaje: "No disponible." } };
    const noSession = { error: { codigo: "sesion_requerida", mensaje: "Entra." } };

    const first = await createClient({ fetch: fetchReturning(jsonResponse(unavailable, 503)) }).getCatalogo();
    const second = await createClient({ fetch: fetchReturning(jsonResponse(noSession, 401)) }).getSesion();

    expect(first.ok || first.error).toMatchObject({ kind: "http", status: 503, code: "almacen_no_disponible" });
    expect(second.ok || second.error).toMatchObject({ kind: "auth", status: 401, code: "sesion_requerida" });
  });

  it.each([
    ["una cadena", { error: "Caso no encontrado" }],
    ["un código que no es texto", { error: { codigo: 7 } }],
    ["un cuerpo vacío", null],
  ])("un error con %s no inventa código", async (_name, cuerpo) => {
    const client = createClient({ fetch: fetchReturning(jsonResponse(cuerpo, 500)) });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toHaveProperty("code");
    expect(result.error.kind).toBe("http");
  });

  it("un error cuyo cuerpo no es JSON sigue siendo http sin código", async () => {
    const client = createClient({ fetch: fetchReturning(new Response("<html>502</html>", { status: 502 })) });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "http", status: 502 });
    expect(result.error).not.toHaveProperty("code");
  });

  it("un fetch que lanza se reporta como network sin estado", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const client = createClient({ fetch: fetchMock });

    const result = await client.getRed({ motor: "m", sistema: "s", tec: ["ac"] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
    expect(result.error.status).toBeUndefined();
    expect(result.error.route).toBe("/api/red");
  });

  it("un cuerpo que no es JSON se reporta como http", async () => {
    const respuesta = new Response("<html>error</html>", { status: 200 });
    const client = createClient({ fetch: fetchReturning(respuesta) });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("http");
    expect(result.error.route).toBe("/api/config");
  });

  it("con validate, un cuerpo que no cumple el esquema da schema con la ruta", async () => {
    const redSinCandidatos = { barras: [], ac_existentes: [] };
    const client = createClient({ fetch: fetchReturning(jsonResponse(redSinCandidatos)), validate: true });

    const result = await client.getRed({ motor: "m", sistema: "s", tec: ["ac"] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("schema");
    expect(result.error.route).toBe("/api/red");
    expect(result.error.message).toContain("ac_candidatos");
  });

  it("con validate, una barra con kv no numérico da schema", async () => {
    const redMala = {
      barras: [{ id: "1", nombre: "1", kv: "230", pd: 0, qd: 0, vmin: 0.95, vmax: 1.05 }],
      ac_existentes: [],
      ac_candidatos: [],
    };
    const client = createClient({ fetch: fetchReturning(jsonResponse(redMala)), validate: true });

    const result = await client.getRed({ motor: "m", sistema: "s", tec: ["ac"] });

    expect(result).toMatchObject({ ok: false, error: { kind: "schema", route: "/api/red" } });
  });

  it("un error del servidor 500 no se valida contra el esquema", async () => {
    const client = createClient({ fetch: fetchReturning(jsonResponse({ error: "x" }, 500)), validate: true });

    const result = await client.getConfig();

    expect(result).toMatchObject({ ok: false, error: { kind: "http", status: 500 } });
  });
});

describe("createClient: cuerpo interrumpido", () => {
  it("un cuerpo que se corta a mitad de lectura es network (reintentable)", async () => {
    const respuestaCortada = {
      ok: true,
      status: 200,
      json: () => Promise.reject(new TypeError("terminated")),
    } as unknown as Response;
    const client = createClient({ fetch: fetchReturning(respuestaCortada) });

    const result = await client.getCatalogo();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "network", route: "/api/catalogo" });
    expect(result.error.message).toContain("terminated");
  });

  it("un cuerpo con JSON mal formado sigue siendo http (no reintentable)", async () => {
    const client = createClient({ fetch: fetchReturning(new Response("{", { status: 200 })) });

    const result = await client.getSesion();

    expect(result).toMatchObject({ ok: false, error: { kind: "http", route: "/api/sesion" } });
  });

  it("el mensaje de network conserva la causa original", async () => {
    const client = createClient({
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")),
    });

    const result = await client.getConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("fetch failed");
  });
});

describe("createClient: AbortSignal", () => {
  it("reenvía la señal de cada llamada al fetch", async () => {
    const fetchMock = fetchReturning(jsonResponse(configExample));
    const client = createClient({ fetch: fetchMock });
    const controller = new AbortController();

    await client.getConfig({ signal: controller.signal });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBe(controller.signal);
  });

  it("una petición abortada por el llamador se rechaza con AbortError, no es un Result", async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const client = createClient({ fetch: fetchMock });
    const controller = new AbortController();

    const pendiente = client.getCatalogo({ signal: controller.signal });
    controller.abort();

    await expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
  });

  it("una petición abortada mientras se lee el cuerpo también se rechaza con AbortError", async () => {
    const controller = new AbortController();
    let bodyReadStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      bodyReadStarted = resolve;
    });
    const respuesta = {
      ok: true,
      status: 200,
      json: () => {
        bodyReadStarted();
        return new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
    } as unknown as Response;
    const client = createClient({ fetch: fetchReturning(respuesta) });

    const pendiente = client.getRed({ motor: "m", sistema: "s", tec: [] }, { signal: controller.signal });
    await started;
    controller.abort();

    await expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
  });
});
