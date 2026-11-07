// @ts-check
import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// The M0 code (design system, API client, IDE SPA) is linted with the strict type-checked rules.
const STRICT_BROWSER_PATHS = ["packages/ui/**/*.{ts,tsx}", "apps/ide-spa/**/*.{ts,tsx}"];
// The Next app is the open-micro-saas template: it keeps the recommended (non type-checked) rules so the
// template's code is not rewritten to satisfy rules it was not written for. New XPAND code under it should
// still be written to the strict standard.
const TEMPLATE_PATHS = ["apps/web/**/*.{ts,tsx,mjs}"];
const BROWSER_PATHS = [...STRICT_BROWSER_PATHS, ...TEMPLATE_PATHS];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "contracts/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "apps/web/.next/**",
      "apps/web/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: TEMPLATE_PATHS,
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: TEMPLATE_PATHS,
    extends: [...tseslint.configs.recommended],
  },
  {
    // Next's own rules (core web vitals) for the Next app only.
    files: TEMPLATE_PATHS,
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    settings: { next: { rootDir: "apps/web/" } },
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The React packages run in the browser (document, ResizeObserver, Intl…); the rest is Node tooling.
    files: BROWSER_PATHS,
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Rules of hooks and exhaustive deps for every component and hook in the React packages and the apps.
    files: BROWSER_PATHS,
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: BROWSER_PATHS,
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
