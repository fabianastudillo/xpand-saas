import { readFileSync } from "node:fs";

/** Version of this interface, read from package.json. Shared by vite.config.ts and vitest.config.ts. */
const UI_VERSION: string = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

/** Vite `define` entries that give the code its build-time constants. */
export const BUILD_DEFINE = { __UI_VERSION__: JSON.stringify(UI_VERSION) } as const;
