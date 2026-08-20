import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@searchos/domain": `${root}packages/domain/src/index.ts`,
      "@searchos/contracts": `${root}packages/contracts/src/index.ts`,
      "@searchos/fixtures": `${root}packages/fixtures/src/index.ts`,
      "@searchos/persistence": `${root}packages/persistence/src/index.ts`,
      "@searchos/retrieval": `${root}packages/retrieval/src/index.ts`,
      "@searchos/model-gateways": `${root}packages/model-gateways/src/index.ts`,
      "@searchos/trust": `${root}packages/trust/src/index.ts`,
      "@searchos/presentation": `${root}packages/presentation/src/index.ts`,
      "@searchos/agent": `${root}packages/agent/src/index.ts`
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    coverage: { reporter: ["text", "json", "html"] }
  }
});
