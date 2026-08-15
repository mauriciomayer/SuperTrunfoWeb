import { test, expect } from "@playwright/test";

/**
 * Camada E2E da Story 1.4 (AD-12).
 *
 * Sobe frontend+backend reais (via `webServer` do playwright.config.ts) e
 * fecha o loop da Sala de Espera aberto pelas Stories 1.2/1.3: o botao
 * "Iniciar" habilitando quando o minimo de 2 Jogadores totais e atingido
 * (Matrix: "Iniciar habilita com 2"), e a lista do host atualizando em
 * tempo real quando um convidado sai (Matrix: "Convidado sai durante a
 * espera").
 */
test("host cria sala com 1 IA e ve o botao Iniciar habilitado assim que jogadores.length chega a 2", async ({
  page,
}) => {
  await page.goto("/");

  const botaoCriarSala = page.getByRole("button", { name: "Criar Sala" });
  await page.getByLabel("Seu nome").fill("Mauricio");

  // Total de jogadores comeca em 4; desce pra 2 e sobe totalIA pra 1 --
  // totalJogadores=2, totalIA=1, entao a sala ja nasce com jogadores.length=2
  // (host + 1 IA), sem precisar de um segundo cliente humano.
  // Confere o valor inicial antes de mexer -- se o default mudar um dia,
  // o teste falha com uma mensagem clara em vez de calcular um total errado
  // silenciosamente a partir de um pressuposto desatualizado.
  await expect(page.getByTestId("total-jogadores")).toHaveText("4");

  const botaoDiminuirTotal = page.getByRole("button", { name: "Diminuir total de jogadores" });
  await botaoDiminuirTotal.click();
  await botaoDiminuirTotal.click();
  await expect(page.getByTestId("total-jogadores")).toHaveText("2");

  await page.getByRole("button", { name: "Aumentar quantidade de IA" }).click();
  await expect(page.getByTestId("total-ia")).toHaveText("1");

  await botaoCriarSala.click();

  // Timeout generoso (mesmo padrao dos outros testes E2E desta suite): o
  // snapshot inicial de estado chega numa mensagem de rede separada do join.
  await expect(page.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByText("IA", { exact: true })).toBeVisible();

  const botaoIniciar = page.getByRole("button", { name: "Iniciar" });
  await expect(botaoIniciar).toBeVisible();
  await expect(botaoIniciar).toBeEnabled();
});

test("convidado sai da Sala de Espera e a lista do host atualiza em tempo real, sem recarregar", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();
  const contextoConvidado = await browser.newContext();
  // Fechamento do convidado e intencional no meio do teste (e o proprio
  // gatilho do que ele verifica) -- essa flag deixa o `finally` idempotente,
  // pra nao vazar o contexto se alguma asserção anterior falhar antes desse
  // ponto (nesse caso o `finally` ainda precisa fechar, so que so uma vez).
  let contextoConvidadoFechado = false;

  try {
    const paginaHost = await contextoHost.newPage();
    const paginaConvidado = await contextoConvidado.newPage();

    await paginaHost.goto("/");

    const botaoCriarSala = paginaHost.getByRole("button", { name: "Criar Sala" });
    await paginaHost.getByLabel("Seu nome").fill("Mauricio");
    await botaoCriarSala.click();

    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    // Sem convidado ainda -- so o host na sala -- o botao "Iniciar" comeca
    // desabilitado (Matrix: "Iniciar desabilitado com 1").
    const botaoIniciarHost = paginaHost.getByRole("button", { name: "Iniciar" });
    await expect(botaoIniciarHost).toBeVisible();
    await expect(botaoIniciarHost).toBeDisabled();

    const linkConvite = await paginaHost.getByTestId("link-convite").textContent();
    const [, caminhoConvite] = linkConvite!.match(/(\/sala\/[\w-]{6,})/)!;

    await paginaConvidado.goto(caminhoConvite);
    await paginaConvidado.getByLabel("Seu nome").fill("Rafael");
    await paginaConvidado.getByRole("button", { name: "Entrar na Sala" }).click();

    await expect(paginaConvidado.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    // O host ve o convidado entrar e o botao "Iniciar" habilita (2 jogadores).
    await expect(paginaHost.getByText("Rafael")).toBeVisible({ timeout: 15_000 });
    await expect(botaoIniciarHost).toBeEnabled();

    // O convidado (nao-host) nunca ve o botao "Iniciar" (Matrix: "Convidado
    // nao ve Iniciar").
    await expect(paginaConvidado.getByRole("button", { name: "Iniciar" })).not.toBeVisible();

    // Convidado sai (fecha a propria aba/contexto) -- simula desconexao
    // real, sem nenhuma acao no lado do host. Fecha aqui (nao so no
    // `finally`) porque e o proprio gatilho do que este teste verifica.
    await contextoConvidado.close();
    contextoConvidadoFechado = true;

    // A lista do host atualiza sozinha (room.state reativo, sem recarregar
    // a pagina) e o botao "Iniciar" volta a desabilitar (so o host resta).
    await expect(paginaHost.getByText("Rafael")).not.toBeVisible({ timeout: 15_000 });
    await expect(botaoIniciarHost).toBeDisabled();
  } finally {
    await contextoHost.close();
    if (!contextoConvidadoFechado) {
      await contextoConvidado.close();
    }
  }
});
