import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

// next.config.js is CommonJS and reads the environment when loaded: each case loads a fresh copy.
const require = createRequire(import.meta.url);
const RUTA = fileURLToPath(new URL("../next.config.js", import.meta.url));

const cargar = () => {
  delete require.cache[RUTA];
  return require(RUTA);
};

afterEach(() => {
  vi.unstubAllEnvs();
  delete require.cache[RUTA];
});

describe("next.config.js images.remotePatterns", () => {
  it("without Google sign-in, /_next/image fetches from no remote host", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(cargar().images.remotePatterns).toEqual([]);
  });

  it("with Google sign-in, only the avatar host lh3.googleusercontent.com, over https", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secreto");

    expect(cargar().images.remotePatterns).toEqual([{ protocol: "https", hostname: "lh3.googleusercontent.com" }]);
  });

  it("half a Google configuration is no configuration", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(cargar().images.remotePatterns).toEqual([]);
  });
});
