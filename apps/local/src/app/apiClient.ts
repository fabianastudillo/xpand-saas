import { createClient, type ApiClient, type ClientOptions } from "@xpand/api";

/**
 * The client the app ships with. Every response is validated against contracts/api, in development and in
 * production (spec §5.3): a body off the contract becomes a «schema» error that names its route, and the shell
 * shows it in «Problemas»; it never reaches a component as data. ajv lives in its own chunk, loaded on demand.
 */
export function createAppClient(options: Omit<ClientOptions, "validate"> = {}): ApiClient {
  return createClient({ ...options, validate: true });
}
