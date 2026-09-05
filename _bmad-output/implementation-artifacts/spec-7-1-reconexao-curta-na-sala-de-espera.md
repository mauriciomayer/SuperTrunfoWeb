---
title: 'Reconexão Curta na Sala de Espera (Story 7.1)'
type: 'feature'
created: '2026-09-04'
status: 'implemented'
review_loop_iteration: 1
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
- **(Adicionado na revisão)** Se qualquer assento estiver no meio da janela de reconexão (`onDrop` chamado, `allowReconnection` ainda não resolveu nem expirou) no momento em que `iniciarPartida` é recebido, o servidor REJEITA o pedido — mesmo padrão de log/early-return já usado pelo gate de `MIN_JOGADORES` existente (`aoReceberIniciarPartida`, sem mensagem de erro nova pro cliente, consistente com o gate já existente). A Partida só pode começar quando todos os assentos estiverem numa conexão real, nunca com um assento "fantasma" no meio da janela.

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
| **(Adicionado na revisão)** `iniciarPartida` recebido com algum assento no meio da janela de reconexão | Host clica Iniciar enquanto outro assento está entre `onDrop` e a `allowReconnection` resolver/expirar | Servidor rejeita o pedido (log + early-return, mesmo padrão do gate `MIN_JOGADORES`); Partida não começa | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/rooms/PartidaRoom.ts` -- `onDrop(client, code)` e `onReconnect(client)` JÁ IMPLEMENTADOS (perto de `onJoin`/`onLeave`, ~linha 1105-1155). `onLeave` (linha ~1163) permanece INALTERADO — verificado em `@colyseus/core` (`Room.mjs`, `_onLeave`/`#_onAfterLeave`) que o framework SEMPRE chama `onLeave` depois de um `onDrop` cujo `allowReconnection` expira, então a lógica de remoção já existente cobre esse caso sem mudança nenhuma.
- **(Adicionado na revisão)** `backend/src/rooms/PartidaRoom.ts` -- `onDrop` precisa rastrear quais `sessionId` estão atualmente numa janela pendente: adicionar um campo `private readonly sessoesReconectando = new Set<string>()`; em `onDrop`, adicionar o `sessionId` ANTES de retornar `allowReconnection(...)`, e encadear `.catch(() => {}).finally(() => this.sessoesReconectando.delete(client.sessionId))` no resultado (o retorno de `allowReconnection` é um `Deferred` com `.catch()` retornando `Promise<any>` de verdade, então `.finally()` funciona no resultado do `.catch()` -- verificado em `@colyseus/core/build/utils/Utils.d.ts`). Isso NÃO interfere no próprio mecanismo de reconexão do framework (o `.catch()` aqui é um handler ADICIONAL sobre o mesmo Deferred, não substitui o que o framework já observa internamente).
- **(Adicionado na revisão)** `backend/src/rooms/PartidaRoom.ts`, `aoReceberIniciarPartida` (linha ~237) -- novo guard: se `this.sessoesReconectando.size > 0`, `console.warn` (mesmo texto/padrão dos outros 2 guards já existentes logo acima, linhas 242-261: "iniciarPartida rejeitado: ...") e `return` cedo, antes do guard de `MIN_JOGADORES` ou depois (ordem não importa). Sem mensagem de erro nova pro cliente -- mesmo padrão silencioso dos guards já existentes.
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- 3 testes JÁ IMPLEMENTADOS perto dos testes "Story 1.4" de `onLeave` (~linha 195-320): (1) reconexão dentro da janela preserva o assento; (2) janela expira sem reconexão remove o assento (teste real de ~30s, sem mock de timer -- `allowReconnection` não usa `this.clock`); (3) confirma que uma desconexão abrupta DURANTE uma Partida em andamento continua convertendo pra IA exatamente como hoje.
- **(Adicionado na revisão)** `backend/src/rooms/PartidaRoom.integration.test.ts` -- 3 testes NOVOS a adicionar (achados independentes de blind-hunter e edge-case-hunter): (a) `iniciarPartida` é rejeitado enquanto um assento está no meio da janela de reconexão -- prova o novo guard; (b) o ÚNICO cliente real da sala (sozinho, sem ninguém mais conectado) cai abruptamente -- a sala NÃO é destruída durante a janela (cenário exato do incidente original, hoje sem nenhum teste cobrindo o caso de zero clientes reais temporariamente); (c) confirma que um terceiro jogador não consegue ocupar o assento reservado de quem está no meio da janela (a vaga continua contando contra `maxClients`).
- `@colyseus/core` (node_modules, `Room.mjs`/`Room.d.ts`, `utils/Utils.d.ts`) -- SOMENTE LEITURA, evidência já coletada: `_onLeave` escolhe `onDrop` (se definido) pra desconexões NÃO consentidas, cai pra `onLeave` senão; depois que `onDrop` roda, `onLeave` sempre roda em seguida (`#_onAfterLeave`, `isDrop=true`); `Deferred.catch()` retorna `Promise<any>` de verdade (suporta `.finally()` encadeado).
- `@colyseus/sdk` (node_modules, `Room.d.ts`/`Room.mjs`) -- SOMENTE LEITURA, evidência já coletada: reconexão automática do cliente já habilitada por padrão (`reconnection.enabled: true`, `maxRetries: 15`, `minDelay: 100ms`, `maxDelay: 5000ms`) — nenhuma mudança de frontend necessária.
- `frontend/src/screens/SalaDeEspera.tsx`, `frontend/src/App.tsx` -- NENHUMA mudança nesta história (ver Boundaries "Never"); Story 7.2 (separada) cobre o aviso visual quando a reconexão falha.
- **(Adicionado na revisão, cosmético)** `backend/src/rooms/PartidaRoom.ts` -- o comentário de `onDrop` interpola `code` sem tratar `undefined` (`code ${code}` vira "code undefined" às vezes); trocar por `code ?? "desconhecido"` ou similar. Também: a explicação do mecanismo `onDrop`/`onLeave`/`Deferred` está duplicada quase verbatim em 5 lugares (comentário da constante, comentário de `onDrop`, comentário de `onReconnect`, e nos 3 testes) -- manter UMA explicação autoritativa (sugestão: no comentário de `onDrop`, que é onde o mecanismo é de fato acionado) e reduzir as outras a uma referência curta, pra não divergir se o mecanismo for revisitado no futuro.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar constante `JANELA_RECONEXAO_SALA_DE_ESPERA_S = 30` (segundos) perto de `DURACAO_REVELACAO_MS`/`PAUSA_IA_MS` -- valor baseado no incidente real investigado (host levou ~28s entre criar a sala e a própria conexão cair).
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `onDrop(client, code)`: se `state.estado === "AguardandoJogadores"`, `return this.allowReconnection(client, JANELA_RECONEXAO_SALA_DE_ESPERA_S)`; caso contrário, no-op.
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `onReconnect(client)`: log de observabilidade, sem mutação de estado.
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- os 3 testes do Code Map, usando `client.leave(false)` (desconexão NÃO consentida — fecha a conexão sem enviar `LEAVE_ROOM`) e `testServer.sdk.reconnect(reconnectionToken)` (reconexão real, mesmo `sessionId`).
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `sessoesReconectando` (Set) e o rastreamento em `onDrop` (achado da revisão).
- [x] `backend/src/rooms/PartidaRoom.ts` -- novo guard em `aoReceberIniciarPartida` rejeitando enquanto `sessoesReconectando.size > 0` (achado da revisão).
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- os 3 testes novos do Code Map (guard de `iniciarPartida`; único cliente real cai e a sala sobrevive; assento reservado não é ocupado por terceiro).
- [x] `backend/src/rooms/PartidaRoom.ts` -- corrigir o log de `onDrop` pra tratar `code` undefined; consolidar a explicação duplicada do mecanismo `onDrop`/`onLeave`/`Deferred` numa única fonte.

**Acceptance Criteria:**
- Given uma Sala de Espera com `estado === "AguardandoJogadores"`, when a conexão de um Jogador cai abruptamente e reconecta dentro de 30s, then ele retoma o MESMO assento (`sessionId` preservado), sem nunca ter saído de `state.jogadores` (FR-36).
- Given a mesma situação, when a janela de 30s expira sem reconexão, then o assento é removido de `state.jogadores` exatamente como o comportamento já existente.
- Given uma Partida já em andamento (`estado` != `"AguardandoJogadores"`), when um Jogador humano perde a conexão abruptamente, then o comportamento confirmado da História 3.2 continua idêntico (assento vira IA, sem nenhuma janela de reconexão) — provado via os testes já existentes dessa história continuando a passar sem alteração.
- Given um assento no meio da janela de reconexão, when o host clica em "Iniciar", then o servidor rejeita o pedido e a Partida não começa (achado da revisão).
- Given uma Sala de Espera com um único cliente real conectado, when esse cliente cai abruptamente, then a sala NÃO é destruída durante a janela de tolerância (achado da revisão -- cenário exato do incidente original).

## Spec Change Log

- **Achado (revisão, blind-hunter + edge-case-hunter, independentemente):** `aoReceberIniciarPartida` não verificava se algum assento estava no meio da janela de reconexão -- a Partida podia começar com um assento "fantasma", e se a vez dele chegasse antes da janela resolver, a Rodada travava esperando uma jogada que nunca chegaria.
- **Decisão do usuário:** bloquear "Iniciar" (rejeitar o pedido, mesmo padrão dos guards já existentes) enquanto qualquer assento estiver no meio da janela de reconexão -- opção recomendada entre 3 alternativas apresentadas.
- **Emenda:** Boundaries "Always"/I-O Matrix (dentro do `<frozen-after-approval>`) ganharam o novo comportamento; Code Map/Tasks (fora do frozen) ganharam o mecanismo de rastreamento (`sessoesReconectando`) e o novo guard, mais 3 testes novos e 2 correções cosméticas também levantadas na mesma revisão.
- **Estado conhecido evitado:** Partida começando com assento fantasma, Rodada travada pra sempre esperando uma jogada impossível.
- **KEEP:** todo o mecanismo `onDrop`/`onReconnect`/`onLeave` já implementado (verificado e revisado sem nenhum apontamento contra ele) sobrevive inalterado -- só ganha o rastreamento adicional de `sessoesReconectando` em cima do que já existe, nunca uma reescrita.

## Design Notes

Colyseus 0.17.x separa desconexão NÃO consentida (`onDrop`, novo aqui) de "saída definitiva" (`onLeave`, já existente) — diferente da API antiga (um `onLeave` único, bifurcado manualmente por um parâmetro `consented`). Chamar `this.allowReconnection(client, segundos)` dentro de `onDrop` e RETORNAR o resultado (nunca só chamar sem `return`) garante que o framework espera esse Deferred antes de decidir se a sala deve ser destruída. Se a promise resolve (reconectou), o framework nunca chama `onLeave` pra esse cliente. Se rejeita (expirou), o framework chama `onLeave` automaticamente depois — por isso `onLeave` não precisa de nenhuma mudança de código, só continua fazendo o que já fazia.

Chamadas EXISTENTES de `client.leave()` (sem argumento, testes atuais) continuam consentidas por padrão (`consented = true` no SDK) — vão direto pro `onLeave`, nunca passam por `onDrop`. Nenhum teste existente é afetado por esta mudança.

## Verification

**Commands:**
- `cd backend && npx vitest run PartidaRoom.integration` -- expected: todos os testes passam, incluindo os 3 novos, sem nenhuma regressão nos testes de `onLeave`/Story 3.2 já existentes.
