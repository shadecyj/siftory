import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "packages/persistence/drizzle/**",
      "apps/desktop/src-tauri/resources/runtime/**",
      "apps/desktop/src-tauri/target/**"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["vitest.config.ts"]
        }
      },
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: "readonly",
        WebSocket: "readonly"
      }
    },
    rules: {
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },
  {
    // This is a bundled, trusted `tauri://` credentials surface rather than
    // application-source JavaScript. Keep browser globals scoped here only.
    files: ["apps/desktop/shell/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  }
);
