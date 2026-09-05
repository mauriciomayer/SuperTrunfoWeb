---
title: 'Reconexão Curta na Sala de Espera (Story 7.1)'
type: 'feature'
created: '2026-09-04'
status: 'implemented'
review_loop_iteration: 0
context: []
baseline_commit: '6065f1c152b4d987bda7ef0d4b99812197ae8d85'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hoje, uma queda ABRUPTA de conexão de qualquer Jogador na Sala de Espera (antes da Partida começar) remove o assento e destrói a sala imediatamente (comportamento padrão do Colyseus) — confirmado como causa raiz de um bug real em produção via log do Render (2 de setembro): o host trocou de app pra compartilhar o link do convite, sua própria conexão caiu (provável suspensão do WebSocket pelo celular em segundo plano), e a sala foi destruída antes dos convidados conseguirem entrar.

**Approach:** Usar o mecanismo `allowReconnection` nativo do Colyseus, através dos hooks `onDrop`/`onReconnect` (API do Colyseus 0.17.x), pra dar uma janela curta de tolerância (30s) especificamente quando `estado === "AguardandoJogadores"`, antes do assento ser removido — sem tocar em nada do comportamento já confirmado pra uma Partida em andamento (Story 3.2).

## Boundaries & Constraints

**Always:**
- A janela de tolerância (30s) só se aplica quando `state.estado === "AguardandoJogadores"`.
- Uma reconexão bem-sucedida dentro da janela preserva o MESMO `sessionId`/entrada em `state.jogadores` — o Jogador nunca é removido durante a espera, nenhuma mutação de estado é necessária pra "restaurar" nada.
- Se a janela expirar sem reconexão, o comportamento é EXATAMENTE o de hoje: remove o Jogador de `state.jogadores` (o `onLeave` já existente, sem nenhuma alteração de lógica).
- O comportamento de uma Partida em andamento (`estado` != `"AguardandoJogadores"`) continua idêntico ao de hoje (Story 3.2: assento vira IA permanentemente) — `onDrop` nunca interfere nesse caminho.
- Sem nenhuma mudança no frontend — o `@colyseus/sdk` (0.17.x) já reconecta automaticamente por padrão (`reconnection.enabled: true`, até 15 tentativas, backoff até 5s por tentativa), cobrindo o lado do cliente sem código novo.

**Ask First:** nenhuma decisão identificada até agora que exija aprovação humana antes de prosseguir.

**Never:**
- Nunca alterar o comportamento de `onLeave` durante uma Partida em andamento (Story 3.2) — decisão já confirmada, fora de escopo.
- Nunca implementar reconexão durante uma Partida em andamento — só a fase de Sala de Espera.
- Nunca adicionar código client-side nesta história — a reconexão automática do SDK já cobre o necessário (Story 7.2, separada, cobre o aviso visual quando a reconexão FALHA).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reconexão dentro da janela | Jogador cai abruptamente na Sala de Espera, reconecta em <30s | Mesmo `sessionId` retoma o assento; `state.jogadores` nunca perde a entrada | N/A |
| Janela expira sem reconexão | Jogador cai abruptamente, não reconecta em 30s | Assento removido de `state.jogadores` (comportamento atual, inalterado) | N/A |
| Desconexão durante Partida em andamento | Jogador cai com `estado` != `AguardandoJogadores` | Comportamento inalterado (Story 3.2: assento vira IA) | N/A |
| Saída consentida (sem UI hoje, mas possível via SDK) | Cliente chama `room.leave()` explicitamente | Vai direto pro `onLeave`, sem esperar reconexão (igual hoje) | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/rooms/PartidaRoom.ts` -- adicionar `onDrop(client, code)` (oferece `allowReconnection` só em `AguardandoJogadores`) e `onReconnect(client)` (no-op/log) como métodos NOVOS na classe (perto de `onJoin`/`onLeave`, ~linha 1074-1163). `onLeave` (linha 1134) permanece INALTERADO — verificado em `@colyseus/core` (`Room.mjs`, `_onLeave`/`#_onAfterLeave`) que o framework SEMPRE chama `onLeave` depois de um `onDrop` cujo `allowReconnection` expira, então a lógica de remoção já existente cobre esse caso sem mudança nenhuma.
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- novos testes perto dos testes "Story 1.4" de `onLeave` (~linha 144): (1) reconexão dentro da janela preserva o assento; (2) janela expira sem reconexão remove o assento (teste real de ~30s, sem mock de timer — `allowReconnection` não usa `this.clock`); (3) confirma que uma desconexão abrupta DURANTE uma Partida em andamento continua convertendo pra IA exatamente como hoje (regressão dos testes Story 3.2 já existentes — nenhum precisa mudar).
- `@colyseus/core` (node_modules, `Room.mjs`/`Room.d.ts`) -- SOMENTE LEITURA, evidência já coletada: `_onLeave` escolhe `onDrop` (se definido) pra desconexões NÃO consentidas, cai pra `onLeave` senão; depois que `onDrop` roda, `onLeave` sempre roda em seguida (`#_onAfterLeave`, `isDrop=true`).
- `@colyseus/sdk` (node_modules, `Room.d.ts`/`Room.mjs`) -- SOMENTE LEITURA, evidência já coletada: reconexão automática do cliente já habilitada por padrão (`reconnection.enabled: true`, `maxRetries: 15`, `minDelay: 100ms`, `maxDelay: 5000ms`) — nenhuma mudança de frontend necessária.
- `frontend/src/screens/SalaDeEspera.tsx`, `frontend/src/App.tsx` -- NENHUMA mudança nesta história (ver Boundaries "Never"); Story 7.2 (separada) cobre o aviso visual quando a reconexão falha.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar constante `JANELA_RECONEXAO_SALA_DE_ESPERA_S = 30` (segundos) perto de `DURACAO_REVELACAO_MS`/`PAUSA_IA_MS` -- valor baseado no incidente real investigado (host levou ~28s entre criar a sala e a própria conexão cair).
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `onDrop(client, code)`: se `state.estado === "AguardandoJogadores"`, `return this.allowReconnection(client, JANELA_RECONEXAO_SALA_DE_ESPERA_S)`; caso contrário, no-op.
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `onReconnect(client)`: log de observabilidade, sem mutação de estado.
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- os 3 testes do Code Map, usando `client.leave(false)` (desconexão NÃO consentida — fecha a conexão sem enviar `LEAVE_ROOM`) e `testServer.sdk.reconnect(reconnectionToken)` (reconexão real, mesmo `sessionId`).

**Acceptance Criteria:**
- Given uma Sala de Espera com `estado === "AguardandoJogadores"`, when a conexão de um Jogador cai abruptamente e reconecta dentro de 30s, then ele retoma o MESMO assento (`sessionId` preservado), sem nunca ter saído de `state.jogadores` (FR-36).
- Given a mesma situação, when a janela de 30s expira sem reconexão, then o assento é removido de `state.jogadores` exatamente como o comportamento já existente.
- Given uma Partida já em andamento (`estado` != `"AguardandoJogadores"`), when um Jogador humano perde a conexão abruptamente, then o comportamento confirmado da História 3.2 continua idêntico (assento vira IA, sem nenhuma janela de reconexão) — provado via os testes já existentes dessa história continuando a passar sem alteração.

## Spec Change Log

## Design Notes

Colyseus 0.17.x separa desconexão NÃO consentida (`onDrop`, novo aqui) de "saída definitiva" (`onLeave`, já existente) — diferente da API antiga (um `onLeave` único, bifurcado manualmente por um parâmetro `consented`). Chamar `this.allowReconnection(client, segundos)` dentro de `onDrop` e RETORNAR o resultado (nunca só chamar sem `return`) garante que o framework espera esse Deferred antes de decidir se a sala deve ser destruída. Se a promise resolve (reconectou), o framework nunca chama `onLeave` pra esse cliente. Se rejeita (expirou), o framework chama `onLeave` automaticamente depois — por isso `onLeave` não precisa de nenhuma mudança de código, só continua fazendo o que já fazia.

Chamadas EXISTENTES de `client.leave()` (sem argumento, testes atuais) continuam consentidas por padrão (`consented = true` no SDK) — vão direto pro `onLeave`, nunca passam por `onDrop`. Nenhum teste existente é afetado por esta mudança.

## Verification

**Commands:**
- `cd backend && npx vitest run PartidaRoom.integration` -- expected: todos os testes passam, incluindo os 3 novos, sem nenhuma regressão nos testes de `onLeave`/Story 3.2 já existentes.
