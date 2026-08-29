---
title: 'Pausa de "IA Pensando"'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md']
baseline_commit: '6b3a1d9b3161cffb98674a6d4eb81f172ddce79e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quando um assento controlado por IA se torna o Jogador da vez, `despacharJogadaDeIA` (`backend/src/rooms/PartidaRoom.ts`) aplica a jogada na MESMA transição síncrona que torna esse assento o Jogador da vez -- sem nenhum `await`/yield entre as duas. O cliente nunca observa um estado intermediário "é a vez da IA, ela ainda não jogou", só recebe o resultado já aplicado -- a jogada parece instantânea.

**Approach:** Adiar o despacho da jogada da IA em 2,5s (mesma duração de `DURACAO_REVELACAO_MS`, já usada pra pausa de revelação) usando o mesmo padrão de timer (`this.clock.setTimeout`). Isso exige revisar AD-4 ("qualquer atraso de ritmo visual é só client-side") -- já documentada como decisão consciente em `epics.md`, não um erro: um atraso client-side sozinho é estruturalmente impossível, já que o cliente nunca vê o estado intermediário pra atrasar visualmente contra ele.

## Boundaries & Constraints

**Always:**
- A pausa se aplica uniformemente aos 3 pontos de chamada de `despacharJogadaDeIA` hoje (`PartidaRoom.ts`, branch de vencedor em `resolverRodada`, branch de empate em `resolverRodada`, e `onLeave` quando a desconexão acontece na própria vez da IA) -- consistência visual: toda jogada automática de IA tem a mesma pausa perceptível, não só algumas.
- Durante a pausa, `estado` já reflete `AguardandoSelecao` com `jogadorDaVez` apontando pro assento IA -- o cliente já pode mostrar "Aguardando {nome da IA} escolher…" (mensagem que já existe em `MesaDeJogo.tsx` pra qualquer Jogador que não seja "eu") normalmente, sem mudança nenhuma de frontend.
- Nenhuma outra mensagem é processada durante a janela de espera (AD-5) -- o timer agendado precisa ser a única coisa pendente, sem reabrir a janela de mensagens concorrentes que a atomicidade de AD-4 fechava antes.
- A decisão em si (`decidirAtributoIA`) continua síncrona, in-process e determinística -- só o MOMENTO do despacho passa a ser adiado, nunca a lógica de decisão.

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- valor (2,5s) e escopo (revisão de AD-4) já confirmados pelo Mauricio.

**Never:**
- Nenhuma mudança em `decidirAtributoIA` (`backend/src/game/ia.ts`) nem na lógica de decisão de atributo -- só o timing do despacho.
- Nenhuma mudança no frontend -- a mensagem "Aguardando {nome} escolher…" já existe e já cobre esse caso (ver Boundaries "Always").
- Nenhuma mudança na pausa de revelação (`DURACAO_REVELACAO_MS`) nem no seu uso existente -- história isolada, timer novo e independente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| IA vence e abre a próxima Rodada | `resolverRodada` (branch sem empate) resolve com o vencedor sendo IA | Pausa de 2,5s antes da jogada automática ser aplicada; `estado` permanece `AguardandoSelecao` com `jogadorDaVez` = IA durante a pausa | N/A |
| Empate e o abridor da próxima Rodada é IA | `resolverRodada` (branch de empate) preserva/avança `jogadorDaVez` pra um assento IA | Mesma pausa de 2,5s antes do despacho | N/A |
| Humano desconecta na própria vez | `onLeave` durante `AguardandoSelecao`, `jogadorDaVez === client.sessionId` | Assento vira IA; mesma pausa de 2,5s antes do despacho automático (a Rodada não trava, só demora um pouco mais pra resolver) | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/rooms/PartidaRoom.ts:57` -- novo `export const PAUSA_IA_MS = 2500;` (mesmo valor/padrão de `DURACAO_REVELACAO_MS`, linha 57).
- `backend/src/rooms/PartidaRoom.ts:826, 982, 1114` -- os 3 pontos de chamada de `this.despacharJogadaDeIA(...)`. Sugestão: extrair um método novo (ex: `agendarJogadaDeIA(jogadorIA: Jogador): void`) que faz `this.clock.setTimeout(() => this.despacharJogadaDeIA(jogadorIA), PAUSA_IA_MS)`, e trocar as 3 chamadas diretas por chamadas a esse método -- evita triplicar o `setTimeout` inline, mesmo espírito de `despacharJogadaDeIA` já ter sido extraída pra evitar duplicação entre os 2 chamadores originais de `resolverRodada`.
- `backend/src/rooms/PartidaRoom.integration.test.ts:2644` -- teste "Matrix: desconexao na propria vez -- assento vira IA E a jogada dispara imediatamente, sem travar a Rodada" fica desatualizado: hoje afirma disparo imediato, depois desta história passa a ter a pausa de 2,5s também. Título e comentário interno ("A jogada dispara IMEDIATAMENTE") precisam refletir a pausa nova; as asserções via `vi.waitFor` (linhas ~683, ~692) devem continuar passando (já usam polling, não sleep fixo), mas confirmar que nenhum `vi.waitFor` relevante tem timeout implícito menor que a pausa nova mais margem.
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- outros testes que hoje esperam a jogada de IA resolver via `vi.waitFor` sem timeout explícito longo (buscar por `decidirAtributoIASpy`/`despacharJogadaDeIA`/cenários com `totalIA > 0`) precisam de revisão -- cada `vi.waitFor` que hoje aguarda um efeito da jogada de IA agora precisa tolerar +2,5s adicionais antes desse efeito aparecer. `testTimeout` global do arquivo é 15000ms (`vitest.integration.config.ts`), folga suficiente na maioria dos casos, mas cada `vi.waitFor` individual sem `{ timeout }` explícito longo pode ter um default menor -- verificar empiricamente rodando a suíte após a mudança, não assumir.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- novo `PAUSA_IA_MS` (2500), novo método agendador (`agendarJogadaDeIA`) que envolve os 3 pontos de despacho de IA existentes com `this.clock.setTimeout`
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- atualizado o teste de desconexão-na-própria-vez (título + comentários + timeouts com folga); adicionado teste novo cobrindo o cenário antes não testado (empate resolvido por IA, `jogadorDaVez` preservado); todos os testes afetados provam o estado intermediário (`AguardandoSelecao` com `jogadorDaVez` = IA, `decidirAtributoIA` ainda não chamada) antes de esperar o despacho de fato
- [x] Revisados os demais `vi.waitFor` relacionados a jogadas de IA na mesma suíte -- vários dependiam do timeout padrão de 1000ms do `vi.waitFor` (menor que a pausa nova), corrigidos com timeout explícito (`PAUSA_IA_MS + margem`)

**Acceptance Criteria:**
- Given é a vez de um Jogador controlado por IA, when a máquina de estados torna esse assento o Jogador da vez, then existe uma pausa perceptível (2,5s) antes da jogada automática dela ser aplicada (FR-33)
- Given a pausa está em andamento, when os demais jogadores olham pra Mesa, then veem que é a vez da IA, sem a jogada já resolvida

## Design Notes

`this.clock` do Colyseus já é usado sem guardar referência explícita nem lógica de cancelamento manual (`DURACAO_REVELACAO_MS`, linha 472) -- o timer é amarrado ao ciclo de vida da própria Room, mesmo padrão a seguir aqui, sem introduzir cleanup novo.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 68/68 verde (8 arquivos)
- `cd backend && npm run test:integration` -- 49/50 verde; a 1 falha (`MatchMakeError: fetch failed` em `testServer.connectTo`, teste de Super Trunfo sem relação com IA) confirmada transiente via reexecução isolada. Suíte real levou ~110s (esperado -- várias rodadas de IA agora incluem a pausa real de 2,5s, não mockável nesta camada)
- `npx tsc -b` (backend) -- limpo

**Manual checks (if no CLI):**
- Jogar uma Partida com IA e confirmar visualmente que existe uma pausa perceptível (não instantânea) antes da IA jogar, tanto quando ela abre uma Rodada normal quanto quando resolve um empate.

## Suggested Review Order

**Mecanismo da pausa**

- Ponto de entrada: `agendarJogadaDeIA`, ponto único pelo qual os 3 chamadores agendam a jogada em vez de despachar na mesma execução síncrona.
  [`PartidaRoom.ts:1025`](../../backend/src/rooms/PartidaRoom.ts#L1025)

- `PAUSA_IA_MS` -- constante nova, deliberadamente separada de `DURACAO_REVELACAO_MS` mesmo com o mesmo valor hoje (o Mauricio pediu pra testar e ajustar depois se precisar -- os dois timers podem divergir no futuro).
  [`PartidaRoom.ts:71`](../../backend/src/rooms/PartidaRoom.ts#L71)

**Testes**

- Cenário novo (não coberto antes desta história): empate resolvido por IA, `jogadorDaVez` preservado em vez de um vencedor novo.
  [`PartidaRoom.integration.test.ts:2603`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2603)

- Os testes de IA existentes (Story 3.1), todos atualizados pra provar o estado intermediário antes de esperar o despacho de fato.
  [`PartidaRoom.integration.test.ts:2160`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2160)
