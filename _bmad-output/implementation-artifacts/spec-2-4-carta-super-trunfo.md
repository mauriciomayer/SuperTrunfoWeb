---
title: 'Carta Super Trunfo'
type: 'feature'
created: '2026-08-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: 'b4958762917dcf28da64c81d18f71d3fa2bf7cb4'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hoje `jogarCarta` sempre exige `atributo` (Story 2.2, decisão explícita) — mesmo se a Carta do topo for a Super Trunfo (`2A`), ela é tratada como qualquer outra. A exceção da letra "A" também não existe.

**Approach:** Quando a Carta do topo do Jogador da vez tem a flag `superTrunfo`, `atributo` vira opcional/ignorado (AD-1) e o servidor decide o vencedor sem comparação: ele mesmo, a menos que algum oponente ativo tenha Carta terminada em "A" no próprio topo — nesse caso, quem estiver mais próximo em ordem circular de entrada na sala vence (AD-8, confirmado), anulando o Super Trunfo. `estado` vai direto pra `SuperTrunfoAcionado` (nunca `Revelando` — sem revelação de Atributo) e reaproveita a mesma pausa/mecânica de resolução da Story 2.3 (concessão de `StateView` pra todos, coleta de Cartas, `ultimoResultado`), só trocando a função que decide o vencedor.

## Boundaries & Constraints

**Always:**
- `aoReceberJogarCarta`: se `remetente.monte[0]?.superTrunfo === true`, pula a validação de `atributo` obrigatório (Story 2.2) — `atributo` fica ignorado, mesmo se vier preenchido.
- `backend/src/game/superTrunfo.ts` (novo): função pura `determinarVencedorSuperTrunfo(jogadoresAtivos, indiceDoSuperTrunfo)` — percorre `jogadoresAtivos` em ordem circular a partir de `indiceDoSuperTrunfo + 1` (wraparound); o primeiro Jogador com `carta.letra === "A"` vence (`anuladoPorCartaA: true`); se nenhum, o próprio Jogador do Super Trunfo vence (`anuladoPorCartaA: false`). `jogadoresAtivos` é a mesma ordem de `state.jogadores` (join order, AD-8).
- `Rodada` ganha `superTrunfoJogadoPor: string` (sessionId, vazio se não aplicável) — setado no lugar de `atributoSelecionado` quando a Carta é Super Trunfo. `resolverRodada()` (Story 2.3) passa a checar esse campo primeiro: se preenchido, usa `determinarVencedorSuperTrunfo`; senão, o fluxo de `determinarVencedor` de sempre. Todo o resto de `resolverRodada` (coleta de Cartas, `StateView` revoga/concede, transição pra `AguardandoSelecao`) é reaproveitado sem mudança de comportamento.
- `estado` vai pra `"SuperTrunfoAcionado"` (nunca `"Revelando"`) quando a Carta é Super Trunfo — mesma concessão de `StateView` da Carta do topo de cada Jogador ativo pra todo mundo (reaproveita o loop já existente em `aoReceberJogarCarta`, disparado pros dois casos).
- Mesma pausa antes de resolver (`DURACAO_REVELACAO_MS`, Story 2.3) — reaproveitada por consistência/simplicidade, mesmo a UX descrevendo a vitória automática como "imediata": a descrição é sobre não ter revelação/comparação de Atributo, não sobre zerar a pausa técnica que já existe pra qualquer transição de estado ser visível em rede (mesma razão técnica da Story 2.3 se aplica aqui).
- `ResultadoRodada` ganha `tipoVitoria: "atributo" | "superTrunfo" | "cartaA"` — `"atributo"` pro fluxo normal (Story 2.3), `"superTrunfo"` quando o próprio Jogador do Super Trunfo venceu sem oposição, `"cartaA"` quando um oponente anulou. Frontend usa isso pro texto do Chip de Resultado (UX-DR7): variantes diferentes de texto pra cada caso, nunca só a cor dourada.
- Frontend: `Carta.tsx` ganha uma prop `destacada?: boolean` (moldura/glow distinto, sem reusar `atributoDestacado` — aqui é a Carta inteira, não uma Linha) — aplicada na Carta vencedora quando `tipoVitoria === "cartaA"` (UX: "a Carta 'A' é destacada como a vencedora real").

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Qualquer mudança no fluxo normal de `atributo` (Story 2.2/2.3) além de reaproveitar `resolverRodada` -- a Carta que não é Super Trunfo continua exigindo `atributo` do mesmo jeito.
- Empate/Funil quando o Super Trunfo é acionado — não existe empate possível nessa mecânica (ou o Super Trunfo vence, ou uma Carta "A" vence; nunca os dois ao mesmo tempo, nunca zero vencedores).
- Eliminação e fim de jogo — Story 2.6.
- Múltiplas Cartas Super Trunfo simultâneas — o Baralho real (`docs/carros_specs.csv`) tem só uma (`2A`), confirmado desde a Story 2.1; não precisa tratar o caso de duas.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Super Trunfo sem oposição | Jogador da vez joga a `2A`, nenhum oponente ativo tem Carta letra "A" no topo | Ele vence automaticamente, coleta todas as Cartas jogadas, `tipoVitoria: "superTrunfo"` | N/A |
| Super Trunfo anulado | Jogador da vez joga a `2A`, um oponente tem Carta letra "A" no topo | O oponente com a "A" vence (não quem jogou o Super Trunfo), coletando tudo; `tipoVitoria: "cartaA"` | N/A |
| Múltiplas Cartas "A" entre oponentes | Dois ou mais oponentes com Carta letra "A" | Vence quem está mais próximo, em ordem circular, do Jogador do Super Trunfo (AD-8) | N/A |
| `atributo` enviado junto com Super Trunfo | `jogarCarta({ atributo: "velocidadeMaxima" })` quando a Carta do topo é a `2A` | `atributo` é ignorado -- resolve como Super Trunfo normalmente | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/game/superTrunfo.ts` (novo) -- `determinarVencedorSuperTrunfo`, pura
- `backend/src/schema/Rodada.ts` -- adicionar `superTrunfoJogadoPor: string`
- `backend/src/schema/ResultadoRodada.ts` -- adicionar `tipoVitoria: string` (união TS, `@type("string")` no wire)
- `backend/src/rooms/PartidaRoom.ts` -- `aoReceberJogarCarta` pula validação de `atributo` pra Carta Super Trunfo, seta `superTrunfoJogadoPor` em vez de `atributoSelecionado`, transiciona pra `"SuperTrunfoAcionado"`; `resolverRodada()` branch pra `determinarVencedorSuperTrunfo` quando aplicável
- `frontend/src/components/Carta.tsx` -- prop `destacada?: boolean`
- `frontend/src/screens/MesaDeJogo.tsx` -- Chip de Resultado com texto por `tipoVitoria`; passa `destacada` pra Carta vencedora quando `tipoVitoria === "cartaA"`

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/superTrunfo.ts` -- `determinarVencedorSuperTrunfo` pura, cobre sem-oposição/uma-Carta-A/múltiplas-Cartas-A-circular
- [x] `backend/src/schema/Rodada.ts` + `ResultadoRodada.ts` -- novos campos
- [x] `backend/src/rooms/PartidaRoom.ts` -- `aoReceberJogarCarta` + `resolverRodada` com o branch de Super Trunfo -- efetiva toda a Matrix
- [x] `frontend/src/components/Carta.tsx` -- prop `destacada`
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- Chip de Resultado com as 3 variantes de texto
- [x] Testes unitários (`superTrunfo.test.ts`) -- sem oposição, uma Carta A, múltiplas Cartas A em ordem circular (incluindo wraparound do fim pro início da lista)
- [x] Teste de integração de Room -- fluxo completo: Super Trunfo sem oposição, Super Trunfo anulado por uma Carta A, `atributo` ignorado quando enviado junto; visibilidade concedida a todos verificada via estado decodificado de cliente real
- [x] Teste de componente cobrindo o Chip de Resultado nas 3 variantes e o destaque da Carta vencedora

**Acceptance Criteria:**
- Given jogo minha Carta do topo e ela tem a flag Super Trunfo, when nenhum oponente tem Carta terminada em "A" nessa Rodada, then venço a Rodada automaticamente, sem comparação de Atributos
- Given acionei o Super Trunfo, when algum oponente tem Carta terminada em "A" na mesma Rodada, then a vitória automática é anulada e o Jogador com a Carta "A" vence, coletando o Super Trunfo e as demais Cartas
- Given mais de um oponente com Carta "A", when o Super Trunfo é acionado, then vence quem estiver mais próximo na ordem de entrada na sala

## Spec Change Log

**Patch pass (implementação, classificado como "patch" -- sem renegociação de intent):**
1. `PartidaRoom.integration.test.ts` -- o teste "Boundaries 'Never'" da Story 2.2 ("atributo continua obrigatório mesmo com a Super Trunfo no topo") travava exatamente o comportamento que esta Story existe pra mudar; reescrito pra confirmar o novo comportamento (`atributo` vira opcional/ignorado, transição direto pra `SuperTrunfoAcionado`) em vez de removido, preservando a cobertura de regressão do "duas checagens antes do branch" (Jogador da vez + estado).
2. `e2e/mesa-de-jogo.spec.ts` -- **não estendido** pro cenário de Super Trunfo, ao contrário do sugerido em Verification. A "mesma técnica de mock de `embaralhar`" citada só existe nos testes de *integração* (rodam a Room em processo, mockável via `vi.mock`) -- o E2E sobe um servidor Colyseus real, processo separado (`playwright.config.ts`), sem hook de determinismo nenhum hoje. Mesmo gap já registrado e aceito pra Story 2.3 (empate residual ~0,6% no E2E de `resolverRodada`); construir esse hook de teste no servidor de produção é uma decisão de arquitetura maior do que o escopo desta história. Registrado em `deferred-work.md`. Cobertura equivalente (Matrix inteira + visibilidade via `StateView` de cliente real) já existe nos testes de integração de Room.

**Patch pass 2 (revisão independente -- blind-hunter, edge-case-hunter, verification-gap -- 3 achados classificados como "patch", corrigidos antes de fechar a história):**
3. **(severo, blind-hunter)** Não havia forma correta de jogar a Super Trunfo pela UI: `Carta.tsx` mostrava as 7 Linhas de Atributo como clicáveis mesmo pra essa Carta (o servidor ignora `atributo` de qualquer jeito), e `colyseusClient.ts`'s `jogarCarta` exigia `atributo: string` obrigatório -- nenhum caminho do frontend conseguia mandar `jogarCarta({})`. Corrigido: `colyseusClient.ts` -- `atributo` agora opcional; `Carta.tsx` -- quando `carta.superTrunfo`, nenhuma Linha tem interatividade própria (sem `role`/`tabIndex`/handler individual) e a Carta INTEIRA vira clicável (`.carta-frente--clicavel`, `role="button"`), disparando `onSelecionarAtributo()` sem argumento; `MesaDeJogo.tsx` -- `aoSelecionarAtributo` aceita `atributo?: string`. Cobertura nova: `colyseusClient.test.ts` (chamada sem atributo), `Carta.test.tsx` (6 casos: clique/teclado na Carta inteira, ausência de interatividade própria nas Linhas, Carta normal nunca vira `role="button"` inteira, fora de vez nada é clicável), `MesaDeJogo.test.tsx` (3 casos, incluindo o clique real a partir de `AguardandoSelecao` -- gap que a implementação original não cobria nenhuma vez).
4. **(edge-case-hunter)** `acharSessionIdDaCartaAVencedora` comparava por `sessionId`, que é `""` pra TODO assento de IA (`Jogador.ts`) -- com 2+ assentos de IA, o vencedor real "empatava" com qualquer outra IA, destacando mais de uma Carta ao mesmo tempo. Corrigido: renomeada pra `acharIndiceDaCartaAVencedora`, retorna o índice em `jogadores` (sempre único por assento) em vez do `sessionId`; comparação nos dois pontos de uso passa a ser por índice (`jogadores.indexOf(...)`). Teste novo em `MesaDeJogo.test.tsx` com 2 assentos de IA (`sessionId` compartilhado `""`), só um deles com Carta "A" de verdade -- confirma que só ele acende.
5. **(verification-gap)** O 3º Acceptance Criterion (múltiplos oponentes com Carta "A", vence o mais próximo em ordem circular) só era exercitado por `superTrunfo.test.ts` (função pura) e por um teste de componente do frontend (Room falsa) -- nunca pela `PartidaRoom` real com `state.jogadores`/`resolverRodada` via `@colyseus/testing`. Adicionado teste novo em `PartidaRoom.integration.test.ts` com 4 Jogadores humanos reais, 2 deles com Carta letra "A" em distâncias circulares diferentes do Jogador do Super Trunfo -- confirma que o mais próximo vence (coleta as 4 Cartas, `tipoVitoria: "cartaA"`), com visibilidade verificada via estado decodificado dos 4 clientes reais.

**Deferred (fora de escopo desta história, achado do edge-case-hunter):** assentos de IA compartilham `sessionId === ""`, então se uma IA vencer QUALQUER Rodada (Super Trunfo ou comparação normal de Atributo -- pré-existente desde a Story 2.2/2.3, não introduzido aqui), `rodadaAtual.jogadorDaVez` vira `""`, que nenhum Client real consegue bater, travando a Partida pra sempre. Raiz do problema é a ausência total de turno/autoplay de IA (território do AD-9, Épico 3) -- registrado em `deferred-work.md`, não corrigido nesta história.

## Design Notes

`resolverRodada` (Story 2.3) já opera direto em `state.jogadores`/`monte[0]`, nunca em `cartasEmDisputa` -- o branch de Super Trunfo só troca QUAL função pura decide o vencedor (`determinarVencedorSuperTrunfo` em vez de `determinarVencedor`), reaproveitando 100% da coleta de Cartas, revogação/concessão de `StateView`, e `ultimoResultado` já existentes. Não duplicar essa lógica.

"Ordem circular" (AD-8) significa: a partir do índice do Jogador do Super Trunfo em `state.jogadores` (join order), andar pra frente com wraparound (`(indice + 1) % total`, `(indice + 2) % total`, ...) até achar a primeira Carta letra "A" ou voltar ao próprio Jogador do Super Trunfo (nesse ponto, sem oposição).

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes de `superTrunfo.ts`, tudo verde -- **verificado (pós-patch), 44/44 passando**
- `cd backend && npm run test:integration` -- expected: inclui o novo fluxo de Super Trunfo (sem oposição, anulado, atributo ignorado), tudo verde -- **verificado (pós-patch, +1 teste de 4 Jogadores/múltiplas Cartas "A"), 31/31 passando**
- `cd frontend && npm test` -- expected: inclui os novos testes de Chip de Resultado/destaque, tudo verde -- **verificado (pós-patch, +10 testes: jogar a Super Trunfo pela UI + índice de IA), 78/78 passando**
- `npx playwright test` (raiz) -- expected: verde; estender o fluxo existente ou novo teste forçando a `2A` no topo de alguém (mesma técnica de mock de `embaralhar` já usada nos testes de integração/E2E da Story 2.2 pro cenário de Super Trunfo) -- **verificado (pós-patch) só a regressão da suite existente, 9/9 verde rodando serial (`--workers=1`); cenário de Super Trunfo NÃO estendido -- ver Spec Change Log item 2 e `deferred-work.md`**

**Manual checks (if no CLI):**
- Jogar até a Super Trunfo cair no topo de alguém (ou forçar via teste manual) e confirmar a vitória automática; testar também o caso de um oponente ter Carta "A" no topo pra ver a anulação.
