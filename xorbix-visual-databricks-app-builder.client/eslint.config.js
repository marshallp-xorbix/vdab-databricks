import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// default value is "dist", but our build outputs to "build" for React Router v7 Framework

/** Raw Tailwind status palettes — use success/warning/destructive/info tokens instead. */
const STATUS_PALETTE_CLASS =
  "\\b(?:bg|text|border|ring|outline|from|to|via|divide)-(?:red|green|amber|yellow|orange|emerald|rose|pink|fuchsia|lime|teal|cyan|sky)-\\d{2,3}\\b";

export default defineConfig([
  globalIgnores(["dist", "build"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${STATUS_PALETTE_CLASS}/]`,
          message:
            "Use semantic status tokens (bg-success-subtle, text-destructive, etc.) instead of raw red/green/amber/yellow/orange palette classes. See App.css theme tokens.",
        },
        {
          selector: `TemplateElement[value.raw=/${STATUS_PALETTE_CLASS}/]`,
          message:
            "Use semantic status tokens (bg-success-subtle, text-destructive, etc.) instead of raw red/green/amber/yellow/orange palette classes. See App.css theme tokens.",
        },
      ],
    },
  },
]);
