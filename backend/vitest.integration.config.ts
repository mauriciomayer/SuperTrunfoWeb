import { defineConfig } from "vitest/config";

/**
 * Camada de integracao de Room da piramide de testes (AD-12).
 * Usa `@colyseus/testing` para exercitar a Room inteira sem navegador.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 15000,
    // `@colyseus/testing` carrega `@colyseus/tools`, que traz `@pm2/io`.
    // Essa lib detecta um canal IPC (`process.send`) do pool "forks" (padrao
    // do Vitest) e comeca a mandar mensagens de monitoramento que colidem
    // com o proprio protocolo de IPC do Vitest. Pool "threads" nao expoe
    // `process.send`, evitando a colisao.
    pool: "threads",
  },
});
