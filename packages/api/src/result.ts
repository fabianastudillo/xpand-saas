/** Failure categories. `auth` covers 401 and 403; `schema` only occurs when validation is enabled. */
export type ApiError = {
  kind: "network" | "http" | "auth" | "schema";
  status?: number;
  route: string;
  message: string;
  /**
   * Machine code of the server's error body (`{ "error": { "codigo", "mensaje" } }`): «caso_no_encontrado»,
   * «almacen_no_disponible»… Absent when the body does not have that shape. Only the code is kept: the interface
   * words every message itself, in the user's language.
   */
  code?: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Throwable wrapper carrying an ApiError; the TanStack Query hooks use it to decide retries and surface failures. */
export class ApiFailure extends Error {
  readonly error: ApiError;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiFailure";
    this.error = error;
  }
}

/** Returns the data of a successful Result, or throws ApiFailure. */
export async function unwrapResult<T>(pending: Promise<Result<T>>): Promise<T> {
  const result = await pending;
  if (result.ok) return result.data;
  throw new ApiFailure(result.error);
}
