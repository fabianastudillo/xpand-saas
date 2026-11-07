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
export type { Barra, LineaCandidata, LineaExistente, Red } from "./generated/red";
export type { Sesion } from "./generated/sesion";
