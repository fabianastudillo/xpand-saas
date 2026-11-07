export { createClient, redQueryString, type ApiClient, type ClientOptions, type RedQuery } from "./client";
export { ApiFailure, unwrapResult, type ApiError, type Result } from "./result";
export { ApiProvider, useCatalogo, useConfig, useRed, useSesion, type ApiProviderProps } from "./hooks";
export type { SchemaValidator, ContractName } from "./validate";
export type { Catalogo } from "./generated/catalogo";
export type { Config } from "./generated/config";
export type { Red } from "./generated/red";
export type { Sesion } from "./generated/sesion";
