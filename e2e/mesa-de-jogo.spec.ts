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

/**
 * Camada E2E da Story 6.2 (AD-12).
 *
 * O project `chromium` deste arquivo (`playwright.config.ts`) ja usa
 * `devices["Desktop Chrome"]` (1280x720) como viewport PADRAO -- ou seja,
 * a partir desta Story, TODOS os testes acima ja exercitam o layout
 * DESKTOP novo (Code Map do spec), nao mais o mobile. Este teste e o novo
 * que prova especificamente as duas metades da Acceptance Criteria de
 * desktop: (1) o mecanismo CSS que a torna possivel (`.app-shell`
 * solta o `max-width: 480px` fixo SO quando `MesaDeJogo` esta ativa,
 * `App.tsx`/`App.css` -- achado critico do spec: "sem tocar nisso,
 * nenhuma mudanca dentro de MesaDeJogo.css teria efeito nenhum"), e (2) o
 * resultado visual (propria Carta + grade de oponentes, cabendo sem
 * rolagem). `getComputedStyle` prova o MECANISMO (a `@media` realmente
 * aplicou), `toBeInViewport()` (mesmo padrao da Story 5.1 acima) prova o
 * RESULTADO (nada fora da tela/precisando rolar).
 */
test("em viewport desktop (1280x720, padrao do projeto), a Mesa de Jogo solta o max-width do app-shell e mostra a propria Carta + a grade de oponentes cabendo sem rolagem", async ({
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
    await expect(paginaHost.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });

    // Mecanismo (Code Map, "achado critico"): sem a classe condicional
    // soltando o max-width, nada do resto desta Story teria efeito, numa
    // janela larga o bastante pro breakpoint (`900px`, App.css).
    const appShell = paginaHost.locator(".app-shell");
    await expect(appShell).toHaveClass(/app-shell--mesa-de-jogo/);
    await expect(appShell).toHaveCSS("max-width", "none");

    // Resultado visual (Acceptance Criteria/FR-34): propria Carta E a
    // grade de oponentes, as DUAS dentro da viewport ao mesmo tempo, sem
    // precisar rolar -- a mesma asserção geometrica da Story 5.1 acima,
    // aplicada aqui as duas colunas do layout novo.
    const minhaCartaWrapper = paginaHost.locator(".mesa-de-jogo__minha-carta");
    const minhaCarta = minhaCartaWrapper.getByTestId("carta-frente");
    const oponentes = paginaHost.getByTestId("oponentes");
    await expect(minhaCarta).toBeInViewport();
    await expect(oponentes).toBeInViewport();

    // "Sem exigir rolagem" (Acceptance Criteria): a pagina inteira cabe na
    // viewport, nunca cresce alem dela -- a asserção mais direta pra essa
    // parte especifica do criterio (independente de qual elemento
    // individual esta ou nao visivel).
    const semRolagem = await paginaHost.evaluate(
      () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    );
    expect(semRolagem).toBe(true);

    // Achado de revisao (rodada de patch): `.mesa-de-jogo__minha-carta` e
    // `.mesa-de-jogo__oponentes` sao celulas IRMAS na mesma linha do grid
    // (`grid-template-areas: "minha-carta oponentes"`, MesaDeJogo.css) -- a
    // altura da linha inteira segue a celula MAIS ALTA das duas, entao um
    // cap defensivo (`max-height`/`overflow-y: auto`) so na de oponentes
    // nao bastaria pra garantir "sem rolagem" se a propria Carta (nunca
    // compactada pro desktop, ao contrario da Carta do oponente) crescesse
    // mais. Confere que a MESMA celula (`minha-carta`) tambem tem o cap --
    // sem esta asserção, remover o cap dela passaria pela suite inteira
    // sem detectar nada (com so 1 oponente/Carta normal como este teste
    // usa, a altura nunca chega perto do orcamento o bastante pra
    // `toBeInViewport()`/`scrollHeight` acima pegarem a ausencia do cap em
    // si -- so um cenario com VARIOS oponentes revelados, como o teste de
    // 4 jogadores logo abaixo, chegaria perto o bastante pra isso importar
    // na pratica).
    await expect(minhaCartaWrapper).toHaveCSS("overflow-y", "auto");
    const maxHeightMinhaCarta = await minhaCartaWrapper.evaluate(
      (elemento) => getComputedStyle(elemento).maxHeight,
    );
    expect(maxHeightMinhaCarta).not.toBe("none");
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});

/**
 * Camada E2E da Story 6.2 (AD-12), continuacao do teste acima.
 *
 * Prova a outra metade da Acceptance Criteria -- abaixo do breakpoint, o
 * layout empilhado mobile-first "continua exatamente como esta, sem
 * alteracao" (Boundaries "Always"). Mesma viewport estreita (375x600) ja
 * usada pela Story 5.1 acima. Em vez de reafirmar posicoes de pixel
 * especificas (Code Map: as asserções das Stories anteriores, todas
 * baseadas em `getByTestId`/`getByRole`/`getByText`, "nunca posição",
 * precisam continuar passando sem alteração -- ver testes acima, todos
 * intactos), este teste prova o MECANISMO que garante isso: a `@media
 * (min-width: 900px)` de `App.css`/`MesaDeJogo.css` nunca chega a
 * ativar abaixo do breakpoint, entao `.app-shell` mantem o
 * `max-width: 480px` original e `.mesa-de-jogo` mantem o `display: flex`
 * de coluna original (nunca vira `display: grid`) -- exatamente a mesma
 * garantia "pixel a pixel inalterado" do Boundaries, verificada via CSS
 * computado em vez de coordenadas.
 */
test("em viewport estreita (375x600), a Mesa de Jogo mantem o app-shell com max-width 480px e o layout empilhado (flex), nunca o grid de desktop", async ({
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

    // Mesmo abaixo do breakpoint, App.tsx ainda aplica a classe
    // condicional (ela so muda o CSS, nunca o JSX) -- mas a `@media` de
    // App.css nunca ativa nessa largura, entao o `max-width` visual
    // continua 480px, exatamente como antes desta Story.
    const appShell = paginaHost.locator(".app-shell");
    await expect(appShell).toHaveClass(/app-shell--mesa-de-jogo/);
    await expect(appShell).toHaveCSS("max-width", "480px");

    // `.mesa-de-jogo` continua com o `display: flex` original -- nunca
    // vira `display: grid` (que so a `@media` de desktop, tambem inativa
    // aqui, introduziria em MesaDeJogo.css).
    await expect(paginaHost.locator(".mesa-de-jogo")).toHaveCSS("display", "flex");
  } finally {
    await contextoHost.close();
    await contextoConvidado.close();
  }
});

/**
 * Camada E2E da Story 6.2 (AD-12), achado de revisao (rodada de patch).
 *
 * Todos os testes ACIMA desta suite (inclusive os 2 novos da Story 6.2)
 * clicam "Diminuir total de jogadores" duas vezes, forcando um jogo de 2
 * (1 oponente) antes de criar a sala -- o fluxo DEFAULT do jogo (sem
 * clicar em nada) e um jogo de 4 (`MAX_JOGADORES`, `CriarSala.tsx`), nunca
 * exercitado por nenhum teste E2E ate agora. Isso significa que os caps
 * defensivos (`max-height`/`overflow-y: auto`) de `.mesa-de-jogo__oponentes`
 * E de `.mesa-de-jogo__minha-carta` (MesaDeJogo.css) nunca foram realmente
 * postos a prova por nenhuma suite -- com so 1 oponente revelado, a altura
 * nunca chega perto do orcamento (`calc(100svh - 250px)`) o bastante pra
 * uma regressao no cap (removido, ou com o valor de `250px` errado) ser
 * detectada.
 *
 * Em vez de orquestrar 4 contextos de navegador humanos (caro e sem
 * necessidade pra provar o layout), este teste usa um unico host humano +
 * 3 vagas de IA declaradas na criacao da sala (`totalIA`, `CriarSala.tsx`)
 * -- essas 3 vagas ja entram em `state.jogadores` no proprio `onCreate` do
 * backend (`PartidaRoom.ts`), entao "Iniciar" fica habilitado so com o
 * host presente, sem esperar nenhum convidado real. Jogador Inicial e'
 * sempre o host (AD-5); um unico clique numa Linha de Atributo real da
 * propria Carta (mesmo padrao do resto da suite, incluindo o caso raro da
 * propria Carta ser a Super Trunfo -- Story 2.4, o clique borbulha pra
 * Carta inteira do mesmo jeito) concede a Carta do topo dos 3 oponentes IA
 * de uma vez -- o pior caso REAL alcancavel que motiva os 2 caps
 * defensivos.
 */
test("em viewport desktop (1280x720), um jogo de 4 jogadores (3 oponentes IA) revelados simultaneamente cabe sem rolagem na pagina (achado de revisao Story 6.2)", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const contextoHost = await browser.newContext();

  try {
    const paginaHost = await contextoHost.newPage();

    await paginaHost.goto("/");

    await paginaHost.getByLabel("Seu nome").fill("Mauricio");

    // Nunca clica em "Diminuir total de jogadores" -- fica no default
    // (4, MAX_JOGADORES, CriarSala.tsx). Declara as 3 vagas restantes como
    // IA de antemao ("Aumentar quantidade de IA") pra nao depender de
    // convidados humanos reais.
    const botaoAumentarIA = paginaHost.getByRole("button", {
      name: "Aumentar quantidade de IA",
    });
    await botaoAumentarIA.click();
    await botaoAumentarIA.click();
    await botaoAumentarIA.click();
    await expect(paginaHost.getByTestId("total-jogadores")).toHaveText("4");
    await expect(paginaHost.getByTestId("total-ia")).toHaveText("3");

    await paginaHost.getByRole("button", { name: "Criar Sala" }).click();

    await expect(paginaHost.getByRole("heading", { name: "Sala de Espera" })).toBeVisible({
      timeout: 15_000,
    });

    // As 3 vagas de IA ja contam em `state.jogadores` desde o `onCreate` --
    // host + 3 IA = 4 jogadores, acima do minimo pra habilitar "Iniciar",
    // sem precisar de nenhum convidado humano real.
    const botaoIniciar = paginaHost.getByRole("button", { name: "Iniciar" });
    await expect(botaoIniciar).toBeEnabled({ timeout: 15_000 });
    await botaoIniciar.click();

    await expect(paginaHost.getByRole("heading", { name: "Mesa de Jogo" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaHost.getByTestId("carta-frente")).toBeVisible({ timeout: 15_000 });

    const oponentes = paginaHost.getByTestId("oponentes");
    // Antes da revelacao: 3 oponentes, todos ainda Carta (verso).
    await expect(oponentes.locator(".carta-verso")).toHaveCount(3);

    const linhaAtributoHost = paginaHost
      .getByTestId("carta-frente")
      .getByTestId("linha-atributo-velocidadeMaxima");
    await linhaAtributoHost.click();

    // Backend real: `PartidaRoom.jogarCarta` transiciona pra "Revelando"
    // (ou "SuperTrunfoAcionado", se a Carta do host calhou de ser a Super
    // Trunfo -- ver comentario da suite acima) e concede a Carta do topo
    // dos 3 oponentes de uma vez -- o pior caso real que os caps defensivos
    // de MesaDeJogo.css existem pra cobrir.
    await expect(oponentes.locator(".carta-frente")).toHaveCount(3, { timeout: 15_000 });
    await expect(oponentes.locator(".carta-verso")).toHaveCount(0);

    // Asserção principal (Acceptance Criteria original da Story 6.2, agora
    // finalmente exercitada no pior caso real): a pagina inteira nunca
    // precisa rolar, mesmo com os 3 oponentes revelados em tamanho cheio ao
    // mesmo tempo -- mesma asserção geometrica do teste de 2 jogadores
    // acima.
    const semRolagemNaPagina = await paginaHost.evaluate(
      () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    );
    expect(semRolagemNaPagina).toBe(true);

    // Alem da pagina nunca rolar, mede o comportamento de cada um dos 2
    // irmaos da linha do grid -- scrollHeight <= clientHeight significa
    // "cabe inteiro, sem sobra pra rolar"; scrollHeight > clientHeight
    // significa que o cap defensivo esta ativamente cortando conteudo,
    // exigindo a propria rolagem interna dele (`overflow-y: auto`) pra nao
    // estourar a linha (e, por tabela, a pagina).
    const alturas = await paginaHost.evaluate(() => {
      const minhaCarta = document.querySelector(".mesa-de-jogo__minha-carta");
      const oponentesEl = document.querySelector('[data-testid="oponentes"]');
      return {
        minhaCarta: {
          scrollHeight: minhaCarta?.scrollHeight ?? null,
          clientHeight: minhaCarta?.clientHeight ?? null,
        },
        oponentes: {
          scrollHeight: oponentesEl?.scrollHeight ?? null,
          clientHeight: oponentesEl?.clientHeight ?? null,
        },
      };
    });
    // Registrado no relatorio do Playwright (`test-results`/stdout) --
    // documenta as alturas medidas de verdade neste pior caso, pra
    // referencia futura sem precisar re-rodar o teste manualmente. Medido
    // depois do ajuste pos-Story 6.2 (grade 2x2 -> linha unica 3x1, pedido
    // do Mauricio): `minhaCarta` 470/470 e `oponentes` 453/453 -- os dois
    // cabem exatamente, sem sobra nenhuma, mesmo no pior caso REAL (3
    // oponentes revelados em tamanho cheio ao mesmo tempo). Com 2x2 (2
    // linhas de Cartas de 220px cada), `oponentes` chegava a 890/470 e
    // dependia do proprio `overflow-y: auto` pra nao estourar a linha
    // compartilhada do grid -- com 1 linha unica (3x1), a altura cai pela
    // metade e o scroll interno deixa de ser necessario neste cenario. O
    // cap (`max-height`/`overflow-y: auto`) continua no CSS como rede de
    // seguranca defensiva (Boundaries original), so que agora normalmente
    // inativo na pratica.
    console.log(
      `[Story 6.2, ajustado pos-lancamento pra 3x1] alturas medidas (4 jogadores, revelado): ${JSON.stringify(alturas)}`,
    );

    expect(alturas.minhaCarta.scrollHeight).not.toBeNull();
    expect(alturas.oponentes.scrollHeight).not.toBeNull();
    // Nem a propria Carta nem a grade de oponentes precisam da propria
    // rolagem interna neste cenario -- os dois cabem dentro do orcamento
    // (`calc(100svh - 250px)`) sem sobra. Uma regressao que fizesse
    // qualquer um dos dois genuinamente exceder o orcamento estouraria a
    // PAGINA inteira (o cap so contem o excesso DENTRO da celula, nunca
    // evita que ela precise rolar) -- exatamente o que a asserção
    // `semRolagemNaPagina` acima provaria ter quebrado.
    expect(alturas.minhaCarta.scrollHeight!).toBeLessThanOrEqual(alturas.minhaCarta.clientHeight!);
    expect(alturas.oponentes.scrollHeight!).toBeLessThanOrEqual(alturas.oponentes.clientHeight!);
  } finally {
    await contextoHost.close();
  }
});
