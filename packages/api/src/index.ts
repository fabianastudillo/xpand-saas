export {
  createClient,
  type ApiClient,
  type ClientOptions,
  type RedQuery,
  type RequestOptions,
} from "./client";
export { ApiFailure, unwrapResult, type ApiError, type Result } from "./result";
export { ApiProvider, useCatalogo, useConfig, useRed, useSesion, type ApiProviderProps } from "./hooks";
export type { Catalogo, Motor, Sistema, Referencia } from "./generated/catalogo";
export type { Config } from "./generated/config";
// The network types the interface uses have every bus identifier as a string (see red.ts); the wire shape of
// the contract, where an identifier may be an integer, is exported apart.
export { normalizeRed, type Barra, type LineaCandidata, type LineaExistente, type Red } from "./red";
export type { IdBarra, Red as RedWire } from "./generated/red";
export type { Sesion } from "./generated/sesion";
