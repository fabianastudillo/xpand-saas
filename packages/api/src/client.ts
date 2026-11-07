import type { Catalogo } from "./generated/catalogo";
import type { Config } from "./generated/config";
import type { Red } from "./generated/red";
import type { Sesion } from "./generated/sesion";
import type { ApiError, Result } from "./result";
import type { ContractName, SchemaValidator } from "./validate";

export interface RedQuery {
  motor: string;
  sistema: string;
  tec: string[];
}

export interface ClientOptions {
  /** Route prefix; empty means same origin (the UI is served by the server itself). */
  baseUrl?: string;
  /** Validates every body with ajv. Intended for development; disabled by default. */
  validate?: boolean;
  fetch?: typeof fetch;
}

export interface ApiClient {
  getCatalogo(): Promise<Result<Catalogo>>;
  getRed(query: RedQuery): Promise<Result<Red>>;
  getConfig(): Promise<Result<Config>>;
  getSesion(): Promise<Result<Sesion>>;
}

interface RouteSpec {
  path: string;
  contract: ContractName;
}

const CATALOGO_ROUTE: RouteSpec = { path: "/api/catalogo", contract: "catalogo" };
const RED_ROUTE: RouteSpec = { path: "/api/red", contract: "red" };
const CONFIG_ROUTE: RouteSpec = { path: "/api/config", contract: "config" };
const SESION_ROUTE: RouteSpec = { path: "/api/sesion", contract: "sesion" };

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const LIST_SEPARATOR = ",";

/** Query string for /api/red: every value is encoded with encodeURIComponent (spaces as %20, never +). */
export function redQueryString(query: RedQuery): string {
  const pares: readonly (readonly [string, string])[] = [
    ["motor", query.motor],
    ["sistema", query.sistema],
    ["tec", query.tec.join(LIST_SEPARATOR)],
  ];
  return pares.map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`).join("&");
}

function failure(error: ApiError): Result<never> {
  return { ok: false, error };
}

function statusError(route: RouteSpec, status: number): ApiError {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return { kind: "auth", status, route: route.path, message: `Session required or expired (HTTP ${String(status)})` };
  }
  return { kind: "http", status, route: route.path, message: `Server responded with HTTP ${String(status)}` };
}

export function createClient(options: ClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? "";
  const shouldValidate = options.validate ?? false;
  let validatorPromise: Promise<SchemaValidator> | undefined;

  // ajv is loaded the first time it is needed, and only with validate: true.
  const loadValidator = (): Promise<SchemaValidator> => {
    validatorPromise ??= import("./validate").then(({ createSchemaValidator }) => createSchemaValidator());
    return validatorPromise;
  };

  async function requestJson<T>(route: RouteSpec, pathWithQuery: string): Promise<Result<T>> {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${pathWithQuery}`);
    } catch {
      return failure({ kind: "network", route: route.path, message: "Could not reach the server" });
    }
    if (!response.ok) return failure(statusError(route, response.status));

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure({ kind: "http", status: response.status, route: route.path, message: "Response body is not valid JSON" });
    }

    if (shouldValidate) {
      const problem = (await loadValidator()).check(route.contract, body);
      if (problem !== undefined) {
        return failure({ kind: "schema", route: route.path, message: problem });
      }
    }
    return { ok: true, data: body as T };
  }

  return {
    getCatalogo: () => requestJson<Catalogo>(CATALOGO_ROUTE, CATALOGO_ROUTE.path),
    getRed: (query) => requestJson<Red>(RED_ROUTE, `${RED_ROUTE.path}?${redQueryString(query)}`),
    getConfig: () => requestJson<Config>(CONFIG_ROUTE, CONFIG_ROUTE.path),
    getSesion: () => requestJson<Sesion>(SESION_ROUTE, SESION_ROUTE.path),
  };
}
