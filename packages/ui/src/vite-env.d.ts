/**
 * Minimal typing of the `import.meta.env` that Vite and Vitest inject. The package does not depend on Vite,
 * so it declares only what it reads.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  /** Absent under bundlers that do not inject it (webpack). */
  readonly env?: ImportMetaEnv;
}

/** Vite's raw import of a stylesheet (used by the token tests). */
declare module "*.css?raw" {
  const source: string;
  export default source;
}
