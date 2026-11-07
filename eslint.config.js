// @ts-check
import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const BROWSER_PATHS = ["packages/ui/**/*.{ts,tsx}", "apps/local/**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "contracts/**", "**/test-results/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
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
    // Rules of hooks and exhaustive deps for every component and hook in the React packages and the app.
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
