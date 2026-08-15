import { test, expect } from "@playwright/test";

/**
 * Camada E2E da Story 1.3 (AD-12).
 *
 * Sobe frontend+backend reais (via `webServer` do playwright.config.ts) e
 * exercita o fluxo real de dois clientes: o host cria a sala (fluxo da
 * Story 1.2) numa aba, o convidado abre o link de convite gerado numa outra
 * aba (contexto de browser separado, sem storage compartilhado -- simula
 * duas pessoas distintas de verdade) e entra informando o nome. Cobre a
 * linha "Entrada valida" da Matrix da Story 1.3 ponta a ponta: ambos
 * terminam vendo a Sala de Espera com host + convidado.
 */
test("host cria a sala, convidado abre o link de convite e entra -- ambos veem a Sala de Espera", async ({ browser }) => {
  // Duas esperas de ate 10s cada em sequencia (host + convidado), rodando
  // ao lado de outros testes desta suite (2+ BrowserContext por teste, 2
  // workers em paralelo) -- alarga o timeout total do teste (padrao 30s)
  // pra nao estourar so por causa da soma das esperas sob essa carga.
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();
  const contextoConvidado = await browser.newContext();

  try {
    const paginaHost = await contextoHost.newPage();
    const paginaConvidado = await contextoConvidado.newPage();

    await paginaHost.goto("/");

    const botaoCriarSala = paginaHost.getByRole("button", { name: "Criar Sala" });
    await paginaHost.getByLabel("Seu nome").fill("Mauricio");
    await expect(botaoCriarSala).toBeEnabled();
    await botaoCriarSala.click();

    // Timeout generoso (mesmo espirito do teste E2E da Story 1.2): o
    // snapshot inicial de estado chega numa mensagem de rede separada do
    // join, e sob carga de mais BrowserContexts rodando em paralelo nesta
    // suite o round-trip pode passar dos 10s originais.
    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    const linkConvite = await paginaHost.getByTestId("link-convite").textContent();
    expect(linkConvite).toMatch(/\/sala\/[\w-]{6,}/);
    const [, caminhoConvite] = linkConvite!.match(/(\/sala\/[\w-]{6,})/)!;

    await paginaConvidado.goto(caminhoConvite);

    await expect(paginaConvidado.getByRole("heading", { name: "Super Trunfo" })).toBeVisible();

    const botaoEntrarSala = paginaConvidado.getByRole("button", { name: "Entrar na Sala" });
    await expect(botaoEntrarSala).toBeDisabled();

    await paginaConvidado.getByLabel("Seu nome").fill("Rafael");
    await expect(botaoEntrarSala).toBeEnabled();
    await botaoEntrarSala.click();

    await expect(paginaConvidado.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    // O convidado ve a si mesmo ("Você") e o host na lista.
    await expect(paginaConvidado.getByText("Mauricio")).toBeVisible();
    await expect(paginaConvidado.getByText("(host)")).toBeVisible();
    await expect(paginaConvidado.getByText("Rafael")).toBeVisible();
    await expect(paginaConvidado.getByText("Você", { exact: true })).toBeVisible();

    // O host, em tempo real (Story 1.4 traz a UX completa disso, mas
    // `onStateChange` ja entrega o dado agora), tambem passa a ver o
    // convidado na propria lista.
    await expect(paginaHost.getByText("Rafael")).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});

test("link de sala inexistente mostra mensagem clara em vez de travar", async ({ page }) => {
  await page.goto("/sala/roomid-que-nao-existe");

  await expect(page.getByRole("heading", { name: "Super Trunfo" })).toBeVisible();
  await expect(page.getByLabel("Seu nome")).toBeVisible();

  await page.getByLabel("Seu nome").fill("Convidado Perdido");
  await page.getByRole("button", { name: "Entrar na Sala" }).click();

  // Verifica o texto exato, nao so a presenca do alerta -- e a mensagem
  // real que `EntrarSala.tsx` decide a partir do erro "not found" do
  // `joinById`, nao um mock.
  await expect(page.getByRole("alert")).toHaveText("Esta sala não existe mais.", {
    timeout: 10_000,
  });
  await expect(page.getByLabel("Seu nome")).not.toBeVisible();
});

test("sala cheia (maxClients atingido de verdade) mostra a mensagem 'Esta sala já está cheia.' pro terceiro convidado", async ({
  browser,
}) => {
  // Este teste encadeia varias esperas generosas (10-15s cada, mesmo padrao
  // dos outros testes desta suite) em sequencia -- criacao da sala, join do
  // primeiro convidado, rejeicao do segundo. Somadas, podem passar do
  // timeout padrao de teste do Playwright (30s), especialmente sob carga
  // (2+ workers rodando outros testes com seus proprios BrowserContexts ao
  // mesmo tempo, todos contra o mesmo backend de dev leve). Timeout do
  // teste inteiro alargado pra dar espaco a essas esperas somadas; nao e o
  // fluxo em si que e lento, e o orcamento default que e curto demais pra
  // um cenario de 3 BrowserContexts com 2 handshakes reais de sala.
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();
  const contextoConvidado1 = await browser.newContext();
  const contextoConvidado2 = await browser.newContext();

  try {
    const paginaHost = await contextoHost.newPage();
    const paginaConvidado1 = await contextoConvidado1.newPage();
    const paginaConvidado2 = await contextoConvidado2.newPage();

    await paginaHost.goto("/");

    await paginaHost.getByLabel("Seu nome").fill("Mauricio");
    // Total de jogadores comeca em 4; desce pra 2 (totalIA fica 0) --
    // maxClients = totalJogadores - totalIA = 2, so host + 1 convidado
    // cabem, o terceiro esbarra na sala cheia.
    const botaoDiminuirTotal = paginaHost.getByRole("button", { name: "Diminuir total de jogadores" });
    await botaoDiminuirTotal.click();
    await botaoDiminuirTotal.click();
    await expect(paginaHost.getByTestId("total-jogadores")).toHaveText("2");

    await paginaHost.getByRole("button", { name: "Criar Sala" }).click();

    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 10_000,
    });

    const linkConvite = await paginaHost.getByTestId("link-convite").textContent();
    const [, caminhoConvite] = linkConvite!.match(/(\/sala\/[\w-]{6,})/)!;

    // Primeiro convidado preenche a ultima vaga humana (maxClients=2).
    await paginaConvidado1.goto(caminhoConvite);
    await paginaConvidado1.getByLabel("Seu nome").fill("Rafael");
    await paginaConvidado1.getByRole("button", { name: "Entrar na Sala" }).click();
    // Timeout mais generoso que o padrao (15s, nao 10s): este teste sobe 3
    // BrowserContext simultaneos, entao a decodificacao do snapshot inicial
    // de estado compete por mais recursos do que os outros testes E2E desta
    // suite -- confirmado que o fluxo em si e correto rodando isolado
    // (--workers=1); o teste inteiro so fica instavel sob paralelismo alto.
    await expect(paginaConvidado1.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    // Segundo convidado tenta o mesmo link -- a sala ja esta no limite.
    await paginaConvidado2.goto(caminhoConvite);
    await paginaConvidado2.getByLabel("Seu nome").fill("Terceiro");
    await paginaConvidado2.getByRole("button", { name: "Entrar na Sala" }).click();

    await expect(paginaConvidado2.getByRole("alert")).toHaveText("Esta sala já está cheia.", {
      timeout: 10_000,
    });
    await expect(paginaConvidado2.getByLabel("Seu nome")).not.toBeVisible();
  } finally {
    await contextoHost.close();
    await contextoConvidado1.close();
    await contextoConvidado2.close();
  }
});
