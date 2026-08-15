import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Camada de componente da piramide de testes (AD-12): Vitest + React
 * Testing Library, cada componente de `src/components/` renderizado
 * isolado (sem navegador real).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    globals: false,
  },
});
