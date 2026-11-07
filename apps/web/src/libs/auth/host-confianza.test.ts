import { describe, expect, it } from "vitest";

import { decidirConfianzaHost } from "./host-confianza";

describe("decidirConfianzaHost", () => {
  it("with AUTH_URL set, Auth.js may trust the host: the request origin is replaced by AUTH_URL", () => {
    expect(decidirConfianzaHost({ AUTH_URL: "https://xpand.example", NODE_ENV: "production" })).toEqual({
      trustHost: true,
    });
  });

  it("without AUTH_URL in production, refuses to start and names the variable", () => {
    const decision = decidirConfianzaHost({ NODE_ENV: "production" });
    expect(decision.trustHost).toBe(false);
    expect(decision.error).toMatch(/AUTH_URL/);
  });

  it("without AUTH_URL in development or test, trusts the host (local machine only)", () => {
    expect(decidirConfianzaHost({ NODE_ENV: "development" })).toEqual({ trustHost: true });
    expect(decidirConfianzaHost({ NODE_ENV: "test" })).toEqual({ trustHost: true });
  });

  it("an empty AUTH_URL counts as unset", () => {
    expect(decidirConfianzaHost({ AUTH_URL: "", NODE_ENV: "production" }).trustHost).toBe(false);
  });

  it("a malformed AUTH_URL is an error, never a trusted host", () => {
    const decision = decidirConfianzaHost({ AUTH_URL: "xpand.example", NODE_ENV: "production" });
    expect(decision.trustHost).toBe(false);
    expect(decision.error).toMatch(/AUTH_URL/);
  });
});
