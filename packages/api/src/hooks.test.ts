// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import catalogoExample from "../../../contracts/api/examples/catalogo.json";
import configExample from "../../../contracts/api/examples/config.json";
import redExample from "../../../contracts/api/examples/red.json";
import sesionExample from "../../../contracts/api/examples/sesion.json";
import { createClient } from "./client";
import { ApiProvider, useCatalogo, useConfig, useRed, useSesion } from "./hooks";
import { ApiFailure } from "./result";

const RETRY_WAIT_MS = 4000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}

function setup(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, validate = false) {
  const queryClient = new QueryClient();
  const client = createClient({ fetch: fetchMock, validate });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { client }, children),
    );
  return { queryClient, wrapper };
}

const CONSULTA_RED = { motor: "jump_misocp", sistema: "tnep_garver6", tec: ["ac"] };

describe("hooks de lectura", () => {
  it("useCatalogo entrega el catálogo cuando la petición tiene éxito", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalogoExample));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(() => useCatalogo(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(catalogoExample);
  });

  it("useConfig y useSesion entregan sus respuestas", async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = urlOf(input);
      return Promise.resolve(jsonResponse(url.endsWith("/api/config") ? configExample : sesionExample));
    });
    const { wrapper } = setup(fetchMock);

    const config = renderHook(() => useConfig(), { wrapper });
    const sesion = renderHook(() => useSesion(), { wrapper });

    await waitFor(() => {
      expect(config.result.current.isSuccess).toBe(true);
    });
    await waitFor(() => {
      expect(sesion.result.current.isSuccess).toBe(true);
    });
    expect(config.result.current.data).toEqual(configExample);
    expect(sesion.result.current.data).toEqual(sesionExample);
  });

  it("useCatalogo no vuelve a pedir el catálogo dentro de su staleTime de 10 minutos", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalogoExample));
    const { wrapper } = setup(fetchMock);
    const primera = renderHook(() => useCatalogo(), { wrapper });
    await waitFor(() => {
      expect(primera.result.current.isSuccess).toBe(true);
    });

    const segunda = renderHook(() => useCatalogo(), { wrapper });

    await waitFor(() => {
      expect(segunda.result.current.isSuccess).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("useRed(null) no hace ninguna petición", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(redExample));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(() => useRed(null), { wrapper });

    await act(() => Promise.resolve());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useRed pide la red con la consulta codificada", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(redExample));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(
      () => useRed({ motor: "jump_misocp", sistema: "SNI año/2032 ñ", tec: ["ac", "sssc"] }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(urlOf(fetchMock.mock.calls[0]?.[0] ?? "")).toBe(
      "/api/red?motor=jump_misocp&sistema=SNI%20a%C3%B1o%2F2032%20%C3%B1&tec=ac%2Csssc",
    );
  });

  it("useRed con validate ofrece el error de esquema como ApiFailure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ barras: [] }));
    const { wrapper } = setup(fetchMock, true);

    const { result } = renderHook(() => useRed(CONSULTA_RED), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiFailure);
    expect(result.current.error?.error).toMatchObject({ kind: "schema", route: "/api/red" });
  });
});

describe("política de reintentos", () => {
  it("no reintenta un 401 (auth)", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(() => useSesion(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.error.kind).toBe("auth");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un error de esquema", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ version: 1 }));
    const { wrapper } = setup(fetchMock, true);

    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.error.kind).toBe("schema");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un 500 (http)", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 500));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta una vez un fallo de red y después se rinde", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const { wrapper } = setup(fetchMock);

    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: RETRY_WAIT_MS });;
    expect(result.current.error?.error.kind).toBe("network");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
