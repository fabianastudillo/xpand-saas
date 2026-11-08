import { describe, expect, it } from "vitest";

import { cookiesAuth, usarCookiesSeguras } from "./cookies";

const NOMBRES_AUTHJS = [
  "sessionToken",
  "callbackUrl",
  "csrfToken",
  "pkceCodeVerifier",
  "state",
  "nonce",
  "webauthnChallenge",
] as const;

describe("cookiesAuth", () => {
  it("names every Auth.js cookie with the xpand prefix, so other apps on localhost cannot collide", () => {
    const cookies = cookiesAuth(false);
    for (const clave of NOMBRES_AUTHJS) {
      expect(cookies[clave]?.name).toMatch(/^xpand\./);
      expect(cookies[clave]?.name).not.toContain("authjs.");
    }
    expect(cookies.sessionToken?.name).toBe("xpand.session-token");
  });

  it("over HTTPS keeps the __Secure- and __Host- prefixes Auth.js uses by default", () => {
    const cookies = cookiesAuth(true);
    expect(cookies.sessionToken?.name).toBe("__Secure-xpand.session-token");
    expect(cookies.csrfToken?.name).toBe("__Host-xpand.csrf-token");
    for (const clave of NOMBRES_AUTHJS) {
      expect(cookies[clave]?.name).toMatch(/^__(Secure|Host)-xpand\./);
    }
  });
});

describe("usarCookiesSeguras", () => {
  it("is true only when AUTH_URL is https", () => {
    expect(usarCookiesSeguras({ AUTH_URL: "https://xpand.example" })).toBe(true);
    expect(usarCookiesSeguras({ AUTH_URL: "http://127.0.0.1:8870" })).toBe(false);
    expect(usarCookiesSeguras({})).toBe(false);
  });
});
