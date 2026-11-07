import { defineConfig } from "vitest/config";

// Pruebas de los scripts de la raiz (importar-casos). Sin Julia ni datos de xpand: volcado y arbol falsos.
export default defineConfig({
  test: { include: ["*.test.ts"], environment: "node" },
});
