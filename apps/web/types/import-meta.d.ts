/**
 * `@xpand/ui` reads `import.meta.env?.DEV` (Vite and Vitest define it; webpack does not). The package declares the
 * type in its own vite-env.d.ts, which this app's compilation does not include: the same declaration, here.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
