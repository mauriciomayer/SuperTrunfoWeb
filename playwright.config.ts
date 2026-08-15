import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 2567;

/**
 * Camada E2E da piramide de testes (AD-12): navegador real contra
 * `frontend/` (Vite) e `backend/` (Colyseus) rodando de verdade.
 *
 * Nesta historia (1.1) so existe o teste trivial de scaffolding --
 * confirma que a pagina abre e a conexao de teste com o backend funciona.
 * Fluxos reais (Criar Sala -> Sala de Espera -> Mesa de Jogo) chegam no
 * resto do Epico 1.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "./backend",
      port: BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      cwd: "./frontend",
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
