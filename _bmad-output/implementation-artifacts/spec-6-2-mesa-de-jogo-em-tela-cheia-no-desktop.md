---
title: 'Mesa de Jogo em Tela Cheia no Desktop'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md']
baseline_commit: 'f36d96058accac16ff4106b82e68cb210df52bdd'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Mesa de Jogo é mobile-first sem nenhum breakpoint de desktop (zero `@media` query em todo o `frontend/`) -- em telas largas, o layout empilhado de mobile continua, exigindo rolagem e desperdiçando espaço.

**Approach:** Novo breakpoint desktop: própria Carta à esquerda, oponentes numa grade 2x2 à direita, ocupando a tela inteira sem rolagem. Mobile continua exatamente como está. **Achado crítico da investigação:** `frontend/src/App.css`'s `.app-shell` (wrapper compartilhado por TODAS as telas, `App.tsx:97`) tem `max-width: 480px` fixo -- sem tocar nisso, nenhuma mudança dentro de `MesaDeJogo.css` teria efeito nenhum em telas largas, o container pai já trava a largura antes. Precisa de um modificador condicional em `.app-shell`, aplicado só quando `MesaDeJogo` está sendo renderizada.

## Boundaries & Constraints

**Always:**
- `App.tsx` ganha uma classe condicional em `.app-shell` (ex: `app-shell--mesa-de-jogo`) só quando `MesaDeJogo` é a tela ativa -- `App.css` usa essa classe pra soltar o `max-width: 480px` dentro do `@media` de desktop. Sem isso, o resto desta história não tem efeito nenhum.
- Acima do breakpoint: própria Carta (coluna esquerda) + oponentes em grade 2x2 (coluna direita), tudo cabendo na viewport sem rolagem vertical.
- Abaixo do breakpoint: layout empilhado atual, pixel a pixel inalterado -- nenhuma classe nova interfere no CSS mobile existente.
- Reflow via CSS (`grid-template-areas` ou equivalente), nunca reordenação do DOM -- a ordem/estrutura dos elementos (`data-testid`, hierarquia) continua igual, só a apresentação visual muda. Os testes E2E existentes de `MesaDeJogo` já rodam no viewport padrão do Playwright (`devices["Desktop Chrome"]`, 1280x720, `playwright.config.ts`) -- ou seja, a partir desta história eles automaticamente passam a exercitar o layout DESKTOP novo, não mais o mobile. Suas asserções (via `getByTestId`/`getByRole`/`getByText`, nunca posição) precisam continuar passando sem alteração.

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- o Mauricio já confirmou grade 2x2 fixa pros oponentes, tela cheia sem rolagem, própria Carta à esquerda.

**Never:**
- Nenhuma mudança no layout mobile existente (breakpoint estreito, abaixo do novo corte).
- Nenhuma mudança em `.app-shell` pras OUTRAS telas (`SalaDeEspera`, `CriarSala`, `EntrarSala`, `FimDePartida`, `FAQ`) -- o modificador só se aplica quando `MesaDeJogo` está ativa.
- Nenhuma mudança no `Funil`, no Chip de Resultado (`position: fixed`, já independente de layout de coluna) nem na mensagem "Aguardando... escolher" além do necessário pra caber no novo layout -- comportamento/lógica de nenhum dos dois muda, só posição.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Desktop (viewport larga) | Mesa de Jogo renderizada numa viewport acima do breakpoint | Duas colunas: própria Carta à esquerda, oponentes em grade 2x2 à direita, tudo visível sem rolar | N/A |
| Mobile (viewport estreita) | Mesa de Jogo renderizada numa viewport abaixo do breakpoint | Layout empilhado atual, sem alteração | N/A |
| Menos de 4 células preenchidas na grade | Partida com 2 ou 3 Jogadores (1 ou 2 oponentes, não 3) | Grade 2x2 com célula(s) vazia(s) -- nunca quebra o layout nem redimensiona os cards existentes | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/App.tsx:96-105` -- `<main className="app-shell">` precisa de uma classe condicional (ex: `` `app-shell${mostrandoMesaDeJogo ? " app-shell--mesa-de-jogo" : ""}` ``) computada a partir da mesma lógica que já decide renderizar `<MesaDeJogo>` (branch `else` do ternário de `estadoPartida`, linha ~104).
- `frontend/src/App.css:1-11` (`.app-shell`, `max-width: 480px`) -- novo `@media (min-width: <breakpoint>px) { .app-shell--mesa-de-jogo { max-width: none; } }` (ou valor maior adequado) -- sem isso, nada do resto funciona.
- `frontend/src/screens/MesaDeJogo.css:4-11` (`.mesa-de-jogo`, hoje `display: flex; flex-direction: column`) -- dentro do mesmo `@media` de desktop, vira `display: grid` com `grid-template-columns`/`grid-template-areas` posicionando `.mesa-de-jogo__minha-carta` numa área e `.mesa-de-jogo__oponentes` noutra, lado a lado. `.mesa-de-jogo__oponentes` (hoje `flex-wrap`) vira `display: grid` com 2 colunas fixas (`grid-template-columns: repeat(2, ...)`) só no desktop -- mobile continua com o `flex-wrap` atual.
- `frontend/src/screens/MesaDeJogo.tsx` -- provavelmente NENHUMA mudança de JSX necessária (reflow é só CSS) -- confirmar durante a implementação; se o `grid-template-areas` exigir um wrapper novo em volta de algum grupo de elementos pra funcionar corretamente, manter os `data-testid`/estrutura existentes intactos.
- `frontend/src/screens/MesaDeJogo.css` -- `Funil`/`.mesa-de-jogo__aguardando` precisam de posicionamento razoável dentro do layout de 2 colunas (ex: span das duas colunas, acima ou abaixo) -- decisão de detalhe a critério de quem implementa, desde que não quebre o "sem rolagem".
- Escolha do breakpoint: nenhum valor existe hoje no projeto (zero `@media` query). Ponto de partida sugerido: `900px` (coluna de oponentes 2x140px + gap ≈ 300-350px, coluna da própria Carta ≈ 350-400px, mais gap/padding) -- ajustar durante a implementação com verificação visual real, não um número fixo cego.
- `e2e/mesa-de-jogo.spec.ts` -- os testes existentes já rodam em 1280x720 (`playwright.config.ts`, `devices["Desktop Chrome"]`) e passam a exercitar o layout desktop novo automaticamente; adicionar um teste novo confirmando que o layout de 2 colunas aparece sem exigir rolagem nessa viewport (mesmo padrão `toBeInViewport()`/`newContext({ viewport })` já usado na Story 5.1), e um teste (ou extensão do existente) confirmando que numa viewport estreita (ex: 375x600, já usado na Story 5.1) o layout empilhado mobile continua inalterado.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/App.tsx` -- classe condicional em `.app-shell` quando `MesaDeJogo` é a tela ativa
- [x] `frontend/src/App.css` -- `@media` de desktop soltando `max-width` só com a classe nova
- [x] `frontend/src/screens/MesaDeJogo.css` -- layout de 2 colunas (própria Carta à esquerda, oponentes em grade 2x2 à direita) dentro do mesmo `@media`, sem tocar no CSS mobile existente
- [x] `frontend/src/screens/MesaDeJogo.test.tsx` -- nenhuma mudança de asserção necessária (reflow é CSS puro, jsdom não avalia layout/`@media`) -- suíte continua verde sem alteração
- [x] `e2e/mesa-de-jogo.spec.ts` -- novo teste confirmando o layout de 2 colunas em viewport desktop sem exigir rolagem; teste confirmando que o layout mobile permanece inalterado numa viewport estreita
- [x] (achado da revisão, corroborado por 2 revisores independentes) `.mesa-de-jogo__minha-carta` -- célula IRMÃ de `.mesa-de-jogo__oponentes` na mesma linha do grid (`grid-template-areas`) -- nunca ganhou o mesmo cap defensivo (`max-height`/`overflow-y: auto`), e nunca foi compactada pro desktop como a Carta do oponente. Uma linha de grid segue sempre a altura da célula MAIS ALTA -- sem esse cap simétrico, a própria Carta (sempre em tamanho cheio) poderia sozinha estourar o orçamento da linha inteira e quebrar "sem rolagem" mesmo com o cap de `oponentes` funcionando perfeitamente. Corrigido com o mesmo `calc(100svh - 250px)`/`overflow-y: auto`
- [x] (achado da revisão, corroborado por 3 revisores independentes) Nenhum teste exercitava o pior caso real (3-4 Jogadores, vários oponentes revelados ao mesmo tempo) -- todo teste E2E da suíte forçava exatamente 2 Jogadores (1 oponente), nunca perto do orçamento defensivo. Novo teste com 1 host + 3 IA (fluxo default nunca antes testado) mede as alturas reais nesse cenário e prova a página nunca rola
- [x] (achado da revisão) `App.tsx`'s `mostrandoMesaDeJogo` duplicava a condição do ternário de render em vez de derivar de uma fonte única -- refatorado pra `telaAtiva`, calculado uma vez, alimentando tanto a classe CSS quanto o ternário

**Acceptance Criteria:**
- Given estou numa Partida em andamento, numa tela larga o suficiente pra layout de duas colunas, when a Mesa de Jogo é exibida, then minha própria Carta fica posicionada à esquerda e os oponentes ficam organizados numa grade 2x2 à direita (FR-34), cabendo na viewport sem exigir rolagem
- Given estou numa tela estreita (mobile), when a Mesa de Jogo é exibida, then o layout empilhado mobile-first continua exatamente como está, sem alteração

## Design Notes

`grid-template-areas` é o caminho natural pra reflow puramente visual sem reordenar o DOM (preserva ordem de tab/leitor de tela, e evita quebrar testes que dependem de `data-testid`/`getByRole` -- nenhum deles é posicional).

Verificação visual real (não só automatizada) vale a pena aqui, mesmo padrão já usado nas Stories 5.4/5.7: abrir a Mesa de Jogo de verdade numa viewport desktop (~1280px) com 2-3 oponentes e conferir que nada corta/rola antes de fechar a história.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 137/137 verde (13 arquivos). Um flake isolado de `App.test.tsx` (`waitFor` sob carga pesada do sistema, ~89s de suíte completa) confirmado transiente via 2 reexecuções isoladas limpas (~2,3s cada) logo em seguida -- lógica do `telaAtiva` revisada linha a linha, sem bug real
- `npx tsc -b` (frontend) -- limpo
- `npx playwright test --workers=1` (raiz) -- 13/13 verde, incluindo os 3 testes de `mesa-de-jogo.spec.ts` desta história (2 originais + o novo de 4 Jogadores). Alturas medidas no pior caso real (4 Jogadores, 3 oponentes revelados): `.mesa-de-jogo__minha-carta` 470/470 (cabe exatamente), `.mesa-de-jogo__oponentes` 888/470 (excede o orçamento de propósito -- rolagem interna própria é o comportamento correto, nunca a página inteira rolando)

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo numa janela desktop larga (~1280px+) com 2-3 oponentes e confirmar visualmente: própria Carta à esquerda, oponentes em grade 2x2 à direita, nada exigindo rolagem.
- Redimensionar a janela pra estreita (mobile) e confirmar que o layout empilhado atual continua idêntico a antes desta história.

## Suggested Review Order

**Achado crítico: o bloqueio do `.app-shell`**

- Ponto de entrada: `telaAtiva`, fonte única que decide tanto a classe CSS quanto o ternário de render (achado da revisão -- antes eram 2 condições independentes).
  [`App.tsx:108`](../../frontend/src/App.tsx#L108)

- `@media` que solta o `max-width: 480px` do container compartilhado, só quando `MesaDeJogo` está ativa.
  [`App.css:31`](../../frontend/src/App.css#L31)

**Layout de 2 colunas**

- `grid-template-areas` -- reflow puramente visual, DOM inalterado.
  [`MesaDeJogo.css:194`](../../frontend/src/screens/MesaDeJogo.css#L194)

- (achado da revisão, o mais importante) Cap defensivo simétrico em `.mesa-de-jogo__minha-carta` -- sem ele, a célula irmã sem compactação poderia sozinha estourar a linha do grid inteira, mesmo com o cap de `oponentes` funcionando.
  [`MesaDeJogo.css:208`](../../frontend/src/screens/MesaDeJogo.css#L208)

**Testes**

- (achado da revisão) Prova do pior caso real -- 4 Jogadores, 3 oponentes revelados, com as alturas medidas de verdade documentadas no próprio teste.
  [`mesa-de-jogo.spec.ts:625`](../../e2e/mesa-de-jogo.spec.ts#L625)
