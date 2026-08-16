import { test, expect } from "@playwright/test";

/**
 * Camada E2E da Story 2.1 (AD-12).
 *
 * Ponta a ponta contra Colyseus real (nao mockado): host cria sala com 2
 * jogadores humanos, clica "Iniciar" de verdade, e ambos os navegadores
 * devem sair da Sala de Espera e chegar na Mesa de Jogo com a propria
 * Carta (frente) visivel -- prova que a distribuicao do Baralho no
 * backend e a troca de tela reativa no frontend (`App.tsx`, ver
 * `App.test.tsx` pra cobertura de componente do mesmo mecanismo) fecham o
 * loop de ponta a ponta. Mesmo padrao de 2 contextos de
 * `e2e/sala-de-espera.spec.ts`.
 */
test("host clica Iniciar com 2 jogadores reais e ambos chegam na Mesa de Jogo com a propria Carta visivel", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();
  const contextoConvidado = await browser.newContext();

  try {
    const paginaHost = await contextoHost.newPage();
    const paginaConvidado = await contextoConvidado.newPage();

    await paginaHost.goto("/");

    await paginaHost.getByLabel("Seu nome").fill("Mauricio");
    // Total de jogadores comeca em 4; desce pra 2 -- so precisa dos 2
    // humanos deste teste, sem vaga de IA sobrando.
    const botaoDiminuirTotal = paginaHost.getByRole("button", {
      name: "Diminuir total de jogadores",
    });
    await botaoDiminuirTotal.click();
    await botaoDiminuirTotal.click();
    await expect(paginaHost.getByTestId("total-jogadores")).toHaveText("2");

    await paginaHost.getByRole("button", { name: "Criar Sala" }).click();

    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    const linkConvite = await paginaHost.getByTestId("link-convite").textContent();
    const [, caminhoConvite] = linkConvite!.match(/(\/sala\/[\w-]{6,})/)!;

    await paginaConvidado.goto(caminhoConvite);
    await paginaConvidado.getByLabel("Seu nome").fill("Rafael");
    await paginaConvidado.getByRole("button", { name: "Entrar na Sala" }).click();

    await expect(paginaConvidado.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    const botaoIniciar = paginaHost.getByRole("button", { name: "Iniciar" });
    await expect(botaoIniciar).toBeEnabled({ timeout: 15_000 });
    await botaoIniciar.click();

    // Backend real: valida host+estado, monta/embaralha/distribui o
    // Baralho (32 Cartas, 16 pra cada com 2 jogadores) e transiciona
    // `estado` pra "AguardandoSelecao" -- o frontend reage sozinho, sem
    // recarregar a pagina (ver `App.tsx`).
    await expect(paginaHost.getByRole("heading", { name: "Mesa de Jogo" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaConvidado.getByRole("heading", { name: "Mesa de Jogo" })).toBeVisible({
      timeout: 15_000,
    });

    // A propria Carta do topo (frente completa, com badge Grupo/Letra) fica
    // visivel pra cada um -- prova, ponta a ponta, que o `StateView`
    // concedido pelo servidor (AD-3) chega decodificado no cliente certo.
    await expect(paginaHost.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });
    await expect(paginaConvidado.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });

    // O unico oponente (2 jogadores) aparece como Carta (verso) -- nunca a
    // frente dele, so a propria Carta de quem esta olhando.
    await expect(paginaHost.getByTestId("oponentes").locator(".carta-verso")).toHaveCount(1);
    await expect(paginaConvidado.getByTestId("oponentes").locator(".carta-verso")).toHaveCount(1);
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});

/**
 * Camada E2E da Story 2.2 (AD-12).
 *
 * Continua de onde o teste acima para: host e convidado ja na Mesa de
 * Jogo, cada um com a propria Carta do topo visivel. O host (Jogador da
 * vez -- sempre o host, AD-5) clica numa Linha de Atributo real da propria
 * Carta; prova ponta a ponta que `jogarCarta` chega no backend, a
 * `PartidaRoom` transiciona pra "Revelando" e concede `StateView` da Carta
 * do topo de AMBOS os Jogadores pra AMBOS os clientes -- os dois
 * navegadores devem terminar vendo as duas Cartas reveladas (frente),
 * inclusive a do oponente, que antes era so verso.
 */
test("host seleciona um Atributo e ambos os jogadores veem as duas Cartas reveladas", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();
  const contextoConvidado = await browser.newContext();

  try {
    const paginaHost = await contextoHost.newPage();
    const paginaConvidado = await contextoConvidado.newPage();

    await paginaHost.goto("/");

    await paginaHost.getByLabel("Seu nome").fill("Mauricio");
    const botaoDiminuirTotal = paginaHost.getByRole("button", {
      name: "Diminuir total de jogadores",
    });
    await botaoDiminuirTotal.click();
    await botaoDiminuirTotal.click();
    await expect(paginaHost.getByTestId("total-jogadores")).toHaveText("2");

    await paginaHost.getByRole("button", { name: "Criar Sala" }).click();

    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    const linkConvite = await paginaHost.getByTestId("link-convite").textContent();
    const [, caminhoConvite] = linkConvite!.match(/(\/sala\/[\w-]{6,})/)!;

    await paginaConvidado.goto(caminhoConvite);
    await paginaConvidado.getByLabel("Seu nome").fill("Rafael");
    await paginaConvidado.getByRole("button", { name: "Entrar na Sala" }).click();

    await expect(paginaConvidado.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    const botaoIniciar = paginaHost.getByRole("button", { name: "Iniciar" });
    await expect(botaoIniciar).toBeEnabled({ timeout: 15_000 });
    await botaoIniciar.click();

    await expect(paginaHost.getByRole("heading", { name: "Mesa de Jogo" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaConvidado.getByRole("heading", { name: "Mesa de Jogo" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaHost.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });
    await expect(paginaConvidado.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });

    // Jogador Inicial = sempre o host (AD-5) -- so o host ve "Aguardando
    // Rafael escolher…" nao aparece pra ele, e sim pro convidado.
    await expect(paginaConvidado.getByTestId("aguardando-selecao")).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaHost.getByTestId("aguardando-selecao")).not.toBeVisible();

    // Clica numa Linha de Atributo real da propria Carta do host --
    // "Velocidade Máxima" existe em toda Carta do Baralho (RF01.4).
    const linhaAtributoHost = paginaHost
      .getByTestId("carta-frente")
      .getByTestId("linha-atributo-velocidadeMaxima");
    await linhaAtributoHost.click();

    // Backend real: `PartidaRoom.jogarCarta` valida, preenche `rodadaAtual`
    // e transiciona pra "Revelando", concedendo a Carta do topo de AMBOS
    // os Jogadores pra AMBOS os clientes -- nenhum oponente deveria
    // continuar como Carta (verso) depois disso, dos dois lados.
    await expect(paginaHost.getByTestId("oponentes").locator(".carta-verso")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(paginaConvidado.getByTestId("oponentes").locator(".carta-verso")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(paginaHost.getByTestId("oponentes").locator(".carta-frente")).toHaveCount(1);
    await expect(paginaConvidado.getByTestId("oponentes").locator(".carta-frente")).toHaveCount(1);

    // A propria Carta de cada um continua visivel tambem -- 2 Cartas
    // (frente) na tela inteira de cada navegador (a propria + a do oponente).
    await expect(paginaHost.getByTestId("carta-frente")).toHaveCount(2);
    await expect(paginaConvidado.getByTestId("carta-frente")).toHaveCount(2);
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});
