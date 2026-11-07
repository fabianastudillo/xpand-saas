import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from "react";
import type { ApiClient, RedQuery } from "./client";
import type { Catalogo } from "./generated/catalogo";
import type { Config } from "./generated/config";
import type { Red } from "./generated/red";
import type { Sesion } from "./generated/sesion";
import { ApiFailure, unwrapResult } from "./result";

const MINUTE_MS = 60 * 1000;
// The catalog is ~4 MB and changes only when the server is updated; the rest is small and read-only too.
const CATALOGO_STALE_MS = 10 * MINUTE_MS;
const RED_STALE_MS = 5 * MINUTE_MS;
const CONFIG_STALE_MS = 5 * MINUTE_MS;
const SESION_STALE_MS = 5 * MINUTE_MS;
const NETWORK_RETRY_LIMIT = 1;

const ApiContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
  client: ApiClient;
  children?: ReactNode;
}

/** Provides the client to the hooks. Must be placed inside a QueryClientProvider. */
export function ApiProvider({ client, children }: ApiProviderProps): ReactElement {
  return createElement(ApiContext.Provider, { value: client }, children);
}

function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (client === null) {
    throw new Error("The @xpand/api hooks need an <ApiProvider client={...}> above them.");
  }
  return client;
}

/** Only network failures are retried, once: auth, schema and http errors surface immediately. */
function shouldRetry(failureCount: number, error: ApiFailure): boolean {
  return error instanceof ApiFailure && error.error.kind === "network" && failureCount < NETWORK_RETRY_LIMIT;
}

/** M0 is read-only: no refetch when the window regains focus; staleness is set per query. */
const READ_ONLY_OPTIONS = { refetchOnWindowFocus: false, retry: shouldRetry } as const;

export function useCatalogo(): UseQueryResult<Catalogo, ApiFailure> {
  const client = useApiClient();
  return useQuery<Catalogo, ApiFailure>({
    ...READ_ONLY_OPTIONS,
    queryKey: ["catalogo"],
    queryFn: ({ signal }) => unwrapResult(client.getCatalogo({ signal })),
    staleTime: CATALOGO_STALE_MS,
  });
}

export function useRed(query: RedQuery | null): UseQueryResult<Red, ApiFailure> {
  const client = useApiClient();
  return useQuery<Red, ApiFailure>({
    ...READ_ONLY_OPTIONS,
    queryKey: ["red", query],
    queryFn: query === null ? skipToken : ({ signal }) => unwrapResult(client.getRed(query, { signal })),
    enabled: query !== null,
    staleTime: RED_STALE_MS,
  });
}

export function useConfig(): UseQueryResult<Config, ApiFailure> {
  const client = useApiClient();
  return useQuery<Config, ApiFailure>({
    ...READ_ONLY_OPTIONS,
    queryKey: ["config"],
    queryFn: ({ signal }) => unwrapResult(client.getConfig({ signal })),
    staleTime: CONFIG_STALE_MS,
  });
}

export function useSesion(): UseQueryResult<Sesion, ApiFailure> {
  const client = useApiClient();
  return useQuery<Sesion, ApiFailure>({
    ...READ_ONLY_OPTIONS,
    queryKey: ["sesion"],
    queryFn: ({ signal }) => unwrapResult(client.getSesion({ signal })),
    staleTime: SESION_STALE_MS,
  });
}
