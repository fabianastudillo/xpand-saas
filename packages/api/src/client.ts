import type { Catalogo } from "./generated/catalogo";
import type { Config } from "./generated/config";
import type { Red as RedWire } from "./generated/red";
import type { Sesion } from "./generated/sesion";
import { normalizeRed, type Red } from "./red";
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
  /**
   * Validates every body against contracts/api with ajv (loaded on demand, in its own chunk). The app enables it in
   * development AND in production (spec §5.3): a response off the contract is a `schema` error that names its
   * route, never a crash. Disabled by default only for callers that bring their own guarantees (tests).
   */
  validate?: boolean;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /**
   * Cancels the request. When the signal is aborted, the call rejects with the abort error
   * instead of resolving to a Result: an abort is a decision of the caller, not a failure to report.
   */
  signal?: AbortSignal;
}

export interface ApiClient {
  getCatalogo(options?: RequestOptions): Promise<Result<Catalogo>>;
  getRed(query: RedQuery, options?: RequestOptions): Promise<Result<Red>>;
  getConfig(options?: RequestOptions): Promise<Result<Config>>;
  getSesion(options?: RequestOptions): Promise<Result<Sesion>>;
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

/** A body that dies while being read (server crash, dropped connection) is retryable; bad JSON is not. */
function bodyReadError(route: RouteSpec, status: number, cause: unknown): ApiError {
  if (cause instanceof SyntaxError) {
    return { kind: "http", status, route: route.path, message: `Response body is not valid JSON: ${String(cause)}` };
  }
  return { kind: "network", route: route.path, message: `Response body was interrupted: ${String(cause)}` };
}

function schemaError(route: RouteSpec, message: string): ApiError {
  return { kind: "schema", route: route.path, message };
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
  // With validation on, the chunk starts downloading now, alongside the first request, instead of after it.
  // A failed warm-up is forgotten here and reported by the request that needs the validator.
  if (shouldValidate) {
    loadValidator().catch(() => {
      validatorPromise = undefined;
    });
  }

  /** Returns the schema error for a non-conforming body, or undefined when it conforms or validation is off. */
  async function schemaProblem(route: RouteSpec, body: unknown): Promise<ApiError | undefined> {
    if (!shouldValidate) return undefined;
    let validator: SchemaValidator;
    try {
      validator = await loadValidator();
    } catch (cause) {
      // Forget the rejected load so that the next call retries it (e.g. after a chunk redeploy).
      validatorPromise = undefined;
      return schemaError(route, `Schema validator could not be loaded: ${String(cause)}`);
    }
    try {
      const problem = validator.check(route.contract, body);
      return problem === undefined ? undefined : schemaError(route, problem);
    } catch (cause) {
      return schemaError(route, `Schema validation could not run: ${String(cause)}`);
    }
  }

  async function requestJson<T>(route: RouteSpec, pathWithQuery: string, signal?: AbortSignal): Promise<Result<T>> {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const init: RequestInit | undefined = signal === undefined ? undefined : { signal };
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${pathWithQuery}`, init);
    } catch (cause) {
      if (signal?.aborted === true) throw cause;
      return failure({ kind: "network", route: route.path, message: `Could not reach the server: ${String(cause)}` });
    }
    if (!response.ok) return failure(statusError(route, response.status));

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      if (signal?.aborted === true) throw cause;
      return failure(bodyReadError(route, response.status, cause));
    }

    const problem = await schemaProblem(route, body);
    if (problem !== undefined) return failure(problem);
    return { ok: true, data: body as T };
  }

  return {
    getCatalogo: (request) => requestJson<Catalogo>(CATALOGO_ROUTE, CATALOGO_ROUTE.path, request?.signal),
    getRed: async (query, request) => {
      const result = await requestJson<RedWire>(RED_ROUTE, `${RED_ROUTE.path}?${redQueryString(query)}`, request?.signal);
      return result.ok ? { ok: true, data: normalizeRed(result.data) } : result;
    },
    getConfig: (request) => requestJson<Config>(CONFIG_ROUTE, CONFIG_ROUTE.path, request?.signal),
    getSesion: (request) => requestJson<Sesion>(SESION_ROUTE, SESION_ROUTE.path, request?.signal),
  };
}
