---
title: 'Fim de Jogo e Eliminação'
type: 'feature'
created: '2026-08-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: '1de45cae0da343cf07ea5acca927e1b12b8b5ab2'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Ativo" sempre significou "todo `state.jogadores`" (comentário explícito desde a Story 2.1/2.2: "ninguém foi eliminado ainda, isso é Story 2.6"). Um Jogador com Monte zerado continua contando como "ativo" pra revelação/turno, e não existe estado `"FimDePartida"` de verdade -- a Partida nunca termina.

**Approach:** "Ativo" passa a significar `monte.length > 0`. Elimina-se implicitamente (sem campo novo -- `quantidadeCartas === 0` já é permanente e suficiente): some da revelação/turno, mas continua conectado vendo a Partida (assento marcado "Eliminado"). Após CADA resolução de Rodada (`resolverRodada`, empate ou não), conta-se quantos Jogadores continuam ativos: **1** → esse é o vencedor da Partida -- absorve o Funil retido (se houver) e `estado` vira `"FimDePartida"`; **2+** → segue o fluxo normal (Story 2.3/2.5), com um ajuste: se o empate acabou de eliminar o próprio `jogadorDaVez` (Carta empatada era a última dele), a vez avança -- circular, ordem de entrada -- pro próximo Jogador ativo (nunca fica travada num Jogador eliminado). Frontend: `FimDePartida.tsx` (novo, substitui `MesaDeJogo` via `App.tsx`) com Banner de Vitória + lista de Jogadores + "Jogar Novamente"; `MesaDeJogo.tsx` marca assentos eliminados com um Chip vermelho "Eliminado" no lugar da Carta/verso.

## Boundaries & Constraints

**Always:**
- `PartidaRoom.aoReceberJogarCarta`: `jogadoresAtivos` passa de `this.state.jogadores` pra `this.state.jogadores.filter((j) => j.monte.length > 0)` -- só Jogadores ativos entram em `cartasEmDisputa`/recebem `StateView` de revelação.
- `PartidaRoom.resolverRodada`, AO FINAL de cada branch (empate e sem-empate, depois de mover/coletar Cartas): computa `ativos = state.jogadores.filter((j) => j.monte.length > 0)`. Se `ativos.length === 1`: esse é o vencedor da Partida -- se havia Funil retido (empate que acabou de eliminar todos os outros), absorve pro Monte dele (mesmo `push` já usado no caminho vencedor da Story 2.5); `estado = "FimDePartida"`; NÃO faz o resto do bookkeeping normal de `AguardandoSelecao`/`jogadorDaVez`.
- No branch de empate (Story 2.5, com `ativos.length >= 2`): se `rodadaAtual.jogadorDaVez` (preservado sem mudar) ficou com `monte.length === 0` por causa deste empate, avança a vez -- circular, ordem de `state.jogadores` (join order, mesmo padrão AD-8 de `determinarVencedorSuperTrunfo`) -- pro próximo Jogador com `monte.length > 0`. Função pura nova, `backend/src/game/turno.ts`, `proximoJogadorAtivo`.
- Frontend `MesaDeJogo.tsx`: qualquer assento (oponente OU o próprio) com `quantidadeCartas === 0` mostra um Chip "Eliminado" (variante nova `.chip-resultado--eliminado`, borda `--vermelho-eliminado` já existente desde a Story 2.3) no lugar da `Carta`/`CartaVerso` -- nunca clicável, mesmo se fosse (por engano) a própria vez.
- `frontend/src/screens/FimDePartida.tsx` (novo): Banner "{vencedor} venceu a partida!" + "Reuniu as N cartas do baralho" (N = contagem real do vencedor, nunca hardcoded 32 -- Partidas com 3 Jogadores descartam 2 Cartas na distribuição, AD-6, nunca chegam a 32), lista de todos os Jogadores com `quantidadeCartas`, botão "Jogar Novamente" que navega pra `/` (`window.location.href`, mesma filosofia "sem lib de rotas" já estabelecida -- nova Sala, sem preservar host/convidado).
- `App.tsx`: nova rota -- `estado === "FimDePartida"` renderiza `FimDePartida` (checada ANTES do fallback pra `MesaDeJogo`).

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- O caso totalmente degenerado de `ativos.length === 0` (dois ou mais Jogadores eliminados no MESMO empate, ninguém sobra) -- log de `warn`, não crasha, não muda `estado`/Cartas (mesmo padrão defensivo de "vencedor desconectou durante a pausa", Story 2.3). Resolver esse empate/vitória-nenhuma de verdade é decisão de design de jogo futura, não desta história -- documentar em `deferred-work.md`.
- IA jogando de fato / takeover por desconexão -- Épico 3 (AD-9), território já delimitado nas histórias anteriores.
- Qualquer UI/lógica de reconexão pro Jogador eliminado -- ele continua conectado vendo a Partida (sem sair da sala), mas não há fluxo de "voltar depois".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Eliminação simples | Monte de um Jogador chega a 0 após coletar/perder numa Rodada normal (sem empate) | Jogador some da revelação/turno seguintes; assento mostra "Eliminado" | N/A |
| Fim de Partida (vitória por coleta) | Um único Jogador ativo resta após uma Rodada sem empate | `estado` vira `FimDePartida`; nenhuma nova Rodada começa | N/A |
| Fim de Partida (vitória por atrito) | Um empate elimina todos os outros Jogadores de uma vez (só o Funil retido + o único sobrevivente) | Sobrevivente absorve o Funil; `estado` vira `FimDePartida` mesmo sem ele ter "vencido" uma comparação | N/A |
| Vez pula Jogador recém-eliminado | Empate elimina o próprio `jogadorDaVez` (2+ Jogadores ainda ativos) | A vez avança -- ordem circular de entrada -- pro próximo Jogador ativo | N/A |
| Eliminação total simultânea (degenerado) | Empate elimina TODOS os Jogadores que jogaram nesta Rodada, ninguém ativo resta | Não crasha; `estado`/Cartas ficam como estavam; log de warn | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/game/turno.ts` (novo) -- `proximoJogadorAtivo`, pura, mesmo padrão circular de `game/superTrunfo.ts`
- `backend/src/rooms/PartidaRoom.ts`:
  - `aoReceberJogarCarta` linha ~332 -- `jogadoresAtivos` passa a filtrar `monte.length > 0`
  - `resolverRodada` branch de empate, linha ~504-560 (Story 2.5) -- adiciona checagem de `ativos.length` e skip de vez
  - `resolverRodada` branch sem-empate, linha ~632-660 (Story 2.3/2.4/2.5) -- adiciona checagem de `ativos.length` após absorver Funil
- `frontend/src/screens/FimDePartida.tsx` (novo) + `.css` + `.test.tsx`
- `frontend/src/App.tsx` -- nova rota pra `estado === "FimDePartida"`
- `frontend/src/screens/MesaDeJogo.tsx` + `.css` -- Chip "Eliminado" (oponente e próprio assento)

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/turno.ts` -- `proximoJogadorAtivo` pura, cobre wraparound e "todo mundo ativo" (não deveria nunca ser chamada nesse caso, mas não deve travar)
- [x] `backend/src/rooms/PartidaRoom.ts` -- `aoReceberJogarCarta` filtra ativos; `resolverRodada` (os dois branches) com checagem de `ativos.length` (1/0/2+) e skip de vez -- efetiva toda a Matrix
- [x] `frontend/src/screens/FimDePartida.tsx` + `App.tsx` + `MesaDeJogo.tsx` -- rota nova, Chip "Eliminado", Banner de Vitória
- [x] Testes unitários (`turno.test.ts`) -- wraparound, múltiplos eliminados em sequência
- [x] Teste de integração de Room -- Matrix inteira (eliminação simples, fim por coleta, fim por atrito via empate, skip de vez, degenerado sem crash) via `@colyseus/testing`
- [x] Teste de componente -- `FimDePartida.tsx` (Banner, lista, botão) e `MesaDeJogo.tsx` (Chip "Eliminado" no lugar certo, nunca clicável)

**Acceptance Criteria:**
- Given o Monte de um Jogador chega a zero Cartas, when isso é detectado, then o Jogador é eliminado -- não escolhe mais Atributo nem tem Cartas reveladas
- Given um único Jogador ativo resta (por coleta normal OU por todos os outros serem eliminados no mesmo empate), when isso é detectado, then a Partida é encerrada, `estado` vira `FimDePartida`, e nenhuma nova Rodada começa

## Design Notes

O check "quantos Jogadores continuam ativos" roda IDÊNTICO nos dois branches de `resolverRodada` (empate e sem-empate) -- é a mesma pergunta ("sobrou só um?") disparada por dois caminhos diferentes (coleta decisiva vs. atrito por empate). Não duplicar a lógica de absorver o Funil: reaproveitar exatamente o `push` já usado pelo caminho vencedor da Story 2.5.

`ativos.length === 1` cobre as duas Acceptance Criteria ao mesmo tempo -- não é preciso saber SE o vencedor "venceu uma comparação" ou "sobrou por atrito", o resultado (Partida acabou, ele fica com tudo) é idêntico.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes de `turno.ts`, tudo verde
- `cd backend && npm run test:integration` -- expected: inclui a Matrix inteira de eliminação/Fim de Partida, tudo verde
- `cd frontend && npm test` -- expected: inclui `FimDePartida.tsx` + ajustes de `MesaDeJogo.tsx`/`App.tsx`, tudo verde
- `npx playwright test` (raiz) -- expected: sem regressão na suite existente; cenário de Fim de Partida forçado NÃO estendido (mesmo gap de determinismo já aceito nas Stories 2.3/2.4/2.5 -- jogar até alguém reunir o Baralho inteiro organicamente levaria dezenas de Rodadas, lento e flaky -- documentar em `deferred-work.md`)

**Manual checks (if no CLI):**
- Jogar uma Partida até o fim (ou forçar via teste manual) e confirmar o Banner de Vitória + "Jogar Novamente" levando de volta pra Criar Sala.
