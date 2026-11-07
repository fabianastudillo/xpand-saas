import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from "react";
import type { ApiClient, RedQuery } from "./client";
import type { Catalogo } from "./generated/catalogo";
import type { Config } from "./generated/config";
import type { Red } from "./generated/red";
import type { Sesion } from "./generated/sesion";
import { ApiFailure, unwrapResult } from "./result";

const CATALOGO_STALE_MS = 10 * 60 * 1000;
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

export function useCatalogo(): UseQueryResult<Catalogo, ApiFailure> {
  const client = useApiClient();
  return useQuery<Catalogo, ApiFailure>({
    queryKey: ["catalogo"],
    queryFn: () => unwrapResult(client.getCatalogo()),
    staleTime: CATALOGO_STALE_MS,
    retry: shouldRetry,
  });
}

export function useRed(query: RedQuery | null): UseQueryResult<Red, ApiFailure> {
  const client = useApiClient();
  return useQuery<Red, ApiFailure>({
    queryKey: ["red", query],
    queryFn: query === null ? skipToken : () => unwrapResult(client.getRed(query)),
    enabled: query !== null,
    retry: shouldRetry,
  });
}

export function useConfig(): UseQueryResult<Config, ApiFailure> {
  const client = useApiClient();
  return useQuery<Config, ApiFailure>({
    queryKey: ["config"],
    queryFn: () => unwrapResult(client.getConfig()),
    retry: shouldRetry,
  });
}

export function useSesion(): UseQueryResult<Sesion, ApiFailure> {
  const client = useApiClient();
  return useQuery<Sesion, ApiFailure>({
    queryKey: ["sesion"],
    queryFn: () => unwrapResult(client.getSesion()),
    retry: shouldRetry,
  });
}

