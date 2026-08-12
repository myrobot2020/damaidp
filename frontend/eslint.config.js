import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const lintedFiles = [
  "src/**/*.{ts,tsx}",
  "tests/**/*.ts",
  "playwright.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
];

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".tanstack",
      ".venv",
      ".vinxi",
      ".wrangler",
      ".pytest_cache",
      "coverage",
      "node_modules",
      "test-results",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: lintedFiles,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  { ...eslintPluginPrettier, files: lintedFiles },
);
