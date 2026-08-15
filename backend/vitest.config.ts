import { defineConfig } from "vitest/config";

/**
 * Camada unitaria da piramide de testes (AD-12).
 * Cobre funcoes puras de `src/game/`. Testes de integracao de Room
 * (`*.integration.test.ts`) rodam separado -- ver `vitest.integration.config.ts`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
  },
});
