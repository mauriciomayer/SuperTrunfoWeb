import { test, expect } from "@playwright/test";

/**
 * Camada E2E do scaffolding (Story 1.1, AD-12).
 *
 * Sobe frontend+backend reais (via `webServer` do playwright.config.ts),
 * abre a pagina e confirma que a conexao de teste com o backend via
 * `@colyseus/sdk` funciona ponta a ponta.
 */
test("abre a pagina e conecta no backend via @colyseus/sdk", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Super Trunfo Web" })).toBeVisible();

  const status = page.getByTestId("status-conexao");
  await expect(status).toContainText("conectado", { timeout: 10_000 });
});
