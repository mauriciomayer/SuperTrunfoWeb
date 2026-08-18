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

/**
 * Camada E2E da Story 2.3 (AD-12).
 *
 * Continua de onde os dois testes acima param: host seleciona um Atributo
 * real ("Potência (HP)" -- a menor taxa de empate natural entre as 32
 * Cartas do Baralho real, ver `docs/carros_specs.csv`, o que mantem este
 * teste nao-determinístico com risco de flake desprezivel sem precisar
 * mockar o Baralho). Aguarda a pausa real de revelacao
 * (`DURACAO_REVELACAO_MS` = 2500ms, aceitavel num teste E2E que ja e mais
 * lento por natureza -- Verification do spec) e confere que o Chip de
 * Resultado aparece, com texto, nos dois navegadores.
 *
 * Risco residual aceito (achado da revisao do diff, registrado em
 * `deferred-work.md`): "Potência (HP)" tem so ~0,6% de chance de empate
 * entre 2 Cartas quaisquer do Baralho real (3 pares empatados em 496
 * combinacoes possiveis) -- baixo o bastante pra nao valer o custo de
 * forcar determinismo aqui. Diferente dos testes de integracao de Room
 * (`PartidaRoom.integration.test.ts`), que rodam a `Room` em processo e
 * podem sobrescrever `embaralhar()` via `vi.mock` pra forcar Cartas
 * especificas no topo, este teste E2E sobe o servidor Colyseus REAL (via
 * `npm run dev` no `backend`, ver `playwright.config.ts`) num processo
 * separado do Playwright -- forcar o mesmo determinismo aqui exigiria um
 * hook de teste dedicado nesse servidor real (ex: uma rota/mensagem so
 * pra testes que aceite um Baralho fixo), que nao existe hoje e nao vale
 * o custo de manutencao so pra eliminar um risco de flake ja desprezivel.
 * No empate raro (~0,6%), o teste falharia esperando o Chip de Resultado
 * (que so aparece sem empate) -- um re-run resolveria.
 */
test("apos a pausa de revelacao, o resultado da Rodada aparece via Chip de Resultado (com texto) nos dois navegadores", async ({
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

    const linhaAtributoHost = paginaHost
      .getByTestId("carta-frente")
      .getByTestId("linha-atributo-potenciaHp");
    await linhaAtributoHost.click();

    // Backend real: revelacao (Story 2.2) primeiro -- ambas as Cartas
    // ficam visiveis em "Revelando" antes de resolver.
    await expect(paginaHost.getByTestId("oponentes").locator(".carta-frente")).toHaveCount(1, {
      timeout: 15_000,
    });

    // A pausa real de revelacao (2,5s) cruza a rede antes de resolver --
    // sem mockar timer, mesmo padrao do resto da suite E2E.
    const chipHost = paginaHost.getByTestId("chip-resultado");
    const chipConvidado = paginaConvidado.getByTestId("chip-resultado");
    await expect(chipHost).toBeVisible({ timeout: 10_000 });
    await expect(chipConvidado).toBeVisible({ timeout: 10_000 });

    // Texto sempre presente (nunca so cor, UX-DR7) -- mesmo vencedor e
    // mesmo Atributo relatado nos dois navegadores.
    const textoChipHost = await chipHost.textContent();
    const textoChipConvidado = await chipConvidado.textContent();
    expect(textoChipHost).toMatch(/venceu a rodada com Potência \(HP\)/);
    expect(textoChipHost).toBe(textoChipConvidado);

    // A Rodada seguinte ja comecou (`resolverRodada`, Story 2.3): estado
    // volta pra AguardandoSelecao com o vencedor escolhendo -- exatamente
    // UM dos dois navegadores mostra "Aguardando…" (o vencedor pode ser
    // qualquer um dos dois, dependendo de quem tinha o maior HP; o teste
    // so afirma que os dois lados nunca concordam ao mesmo tempo).
    const hostEsperando = await paginaHost.getByTestId("aguardando-selecao").isVisible();
    const convidadoEsperando = await paginaConvidado.getByTestId("aguardando-selecao").isVisible();
    expect(hostEsperando).not.toBe(convidadoEsperando);
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});

/**
 * Camada E2E da Story 5.1 (AD-12, bugfix).
 *
 * Achado de revisao do diff original desta Story: o teste acima ja prova
 * que o Chip de Resultado aparece (`toBeVisible()`), mas isso NAO prova o
 * bug que esta Story de fato corrige -- `toBeVisible()` passa pra qualquer
 * elemento com bounding box nao-vazia, mesmo rolado pra fora da viewport, e
 * o resto da suite roda so em viewport desktop padrao, nunca na viewport
 * estreita onde o bug original reproduzia. Sem este teste, uma regressao
 * futura que revertesse `.chip-resultado--overlay` de volta pra
 * `position: static` (exatamente o bug desta Story) passaria pela suite
 * inteira sem detectar nada.
 *
 * `page.setViewportSize` (via opcao `viewport` do Context, escopada so a
 * este teste -- nao mexe no viewport padrao dos outros testes/projects)
 * reproduz o cenario ~375x600 dos Manual Checks do spec. `toBeInViewport()`
 * (nativo do Playwright) confere que o Chip realmente intersecta a
 * viewport atual SEM nenhuma rolagem -- a asserção certa pra "visivel sem
 * exigir rolagem" (Acceptance Criteria do spec), ao contrario de
 * `toBeVisible()`.
 */
test("em viewport estreita (375x600), o Chip de Resultado fica dentro da viewport sem exigir rolagem", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext({ viewport: { width: 375, height: 600 } });
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
    await expect(paginaHost.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });

    const linhaAtributoHost = paginaHost
      .getByTestId("carta-frente")
      .getByTestId("linha-atributo-potenciaHp");
    await linhaAtributoHost.click();

    // Mesma pausa real de revelacao (2,5s) dos outros testes desta suite --
    // sem mockar timer.
    const chipHost = paginaHost.getByTestId("chip-resultado");
    await expect(chipHost).toBeVisible({ timeout: 10_000 });

    // A asserção que realmente prova a correção desta Story: o Chip
    // intersecta a viewport de 375x600 SEM nenhuma rolagem -- teria
    // falhado no bug original (Chip nascia abaixo da dobra, so alcancavel
    // rolando) e falharia de novo se `position: fixed` fosse revertido.
    await expect(chipHost).toBeInViewport();
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});
