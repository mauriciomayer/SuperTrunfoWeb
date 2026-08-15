import { test, expect } from "@playwright/test";

/**
 * Camada E2E da Story 1.2 (AD-12).
 *
 * Sobe frontend+backend reais (via `webServer` do playwright.config.ts) e
 * exercita o fluxo real Criar Sala -> Sala de Espera ponta a ponta,
 * substituindo o teste de scaffolding da Story 1.1 (que so provava a
 * conexao de teste com a pagina placeholder, hoje removida).
 */
test("cria uma sala com IA e chega na Sala de Espera vendo o host e a pilula de IA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Super Trunfo" })).toBeVisible();

  const botaoCriarSala = page.getByRole("button", { name: "Criar Sala" });
  await expect(botaoCriarSala).toBeDisabled();

  await page.getByLabel("Seu nome").fill("Mauricio");
  await expect(botaoCriarSala).toBeEnabled();

  // Total de jogadores comeca em 4; sobe totalIA pra 1 (fica 1 IA + host = 2 vagas usadas de 4).
  await page.getByRole("button", { name: "Aumentar quantidade de IA" }).click();

  await botaoCriarSala.click();

  // Timeout generoso (mesmo padrao do teste E2E da Story 1.1): o snapshot
  // inicial de estado (`ROOM_STATE`) chega numa mensagem de rede separada
  // do join, e a Sala de Espera so sai do estado "Carregando sala…" quando
  // ele chega -- o tempo de round-trip real varia bem mais que o timeout
  // padrao do Playwright (5s), especialmente com o backend ainda "frio".
  await expect(page.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({ timeout: 10_000 });

  const linkConvite = page.getByTestId("link-convite");
  await expect(linkConvite).toBeVisible();
  // Confere que existe um roomId de verdade depois de "/sala/" (nao so o
  // prefixo -- um roomId fixo/errado tambem passaria num toContainText).
  await expect(linkConvite).toHaveText(/\/sala\/[\w-]{6,}/);

  await expect(page.getByText("Mauricio")).toBeVisible();
  await expect(page.getByText("(host)")).toBeVisible();
  await expect(page.getByText("Você", { exact: true })).toBeVisible();
  await expect(page.getByText("IA", { exact: true })).toBeVisible();
});
