import type { NextAuthConfig } from "next-auth";

type CookiesAuth = NonNullable<NextAuthConfig["cookies"]>;

/**
 * Prefijo propio de las cookies de Auth.js. Los navegadores no separan las cookies por puerto: toda app con Auth.js
 * en `localhost` usa por defecto `authjs.session-token`, y la de otra app (firmada con otro secreto) llega aquí y
 * falla con «JWTSessionError: no matching decryption secret». Con nombres propios cada app lee solo las suyas.
 */
const PREFIJO = "xpand";

/** Cookies seguras (`__Secure-`/`__Host-`, `secure`) solo si la URL pública es HTTPS; `AUTH_URL` es obligatoria en producción. */
export function usarCookiesSeguras(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.AUTH_URL?.startsWith("https://") ?? false;
}

/**
 * Nombres de las cookies de Auth.js con el prefijo de XPAND. Solo cambian los nombres: Auth.js fusiona estas entradas
 * con sus opciones por defecto (httpOnly, sameSite lax, path, secure, maxAge). Con `seguras` se conservan los
 * prefijos `__Secure-` y `__Host-` que Auth.js usa en HTTPS.
 */
export function cookiesAuth(seguras: boolean): CookiesAuth {
  const seguro = seguras ? "__Secure-" : "";
  const host = seguras ? "__Host-" : "";
  const nombre = (prefijo: string, sufijo: string) => ({ name: `${prefijo}${PREFIJO}.${sufijo}` });

  return {
    sessionToken: nombre(seguro, "session-token"),
    callbackUrl: nombre(seguro, "callback-url"),
    csrfToken: nombre(host, "csrf-token"),
    pkceCodeVerifier: nombre(seguro, "pkce.code_verifier"),
    state: nombre(seguro, "state"),
    nonce: nombre(seguro, "nonce"),
    webauthnChallenge: nombre(seguro, "challenge"),
  } as CookiesAuth;
}
