---
title: 'Entrar na Sala'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
baseline_commit: 'f73321918e029f7f6e319545ba65a23c680e66fc'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O link de convite que a Sala de Espera mostra (Story 1.2) hoje é só texto — não existe rota nem tela que o abra. Um convidado que clica no link não tem como entrar na Partida.

**Approach:** Adicionar roteamento local mínimo (sem lib de rotas) que detecta `/sala/:roomId` na URL e mostra a tela Entrar na Sala em vez de Criar Sala. O convidado digita o nome e confirma, disparando `entrarSala` via `client.joinById(roomId, { nome })` (AD-2) — que reaproveita o `PartidaRoom.onJoin` já existente da Story 1.2 sem nenhuma mudança no backend, já que o rejeitar sala cheia (`maxClients`) e sala inexistente já são comportamento nativo do matchmaking do Colyseus. Trata os dois casos de erro (link inválido / sala cheia) substituindo o formulário por uma mensagem, igual ao mockup.

## Boundaries & Constraints

**Always:**
- Roteamento via `window.location.pathname` (sem lib de rotas — consistente com a decisão da Story 1.2 e RNF fora de escopo pra isso): `/sala/{roomId}` renderiza `EntrarSala`; qualquer outro path renderiza `CriarSala` (comportamento atual, raiz).
- Intent `entrarSala`: `client.joinById(roomId, { nome })` (AD-1, AD-2) — nunca `joinOrCreate`/matchmaking genérico.
- Nenhuma mudança no backend: `PartidaRoom.onJoin` (Story 1.2) já valida nome vazio e já marca `isHost: false` pra quem não é o primeiro humano — reaproveitar sem alteração. Sala cheia (`maxClients`) e sala inexistente já são rejeitados nativamente pelo matchmaking do Colyseus ao usar `joinById`.
- Botão "Entrar na Sala" desabilitado até nome preenchido (mesmo padrão da Story 1.2).
- Ao falhar (sala cheia ou inexistente), substituir o formulário inteiro por uma mensagem — não um erro inline como em `CriarSala` — conforme o mockup `mockups/key-entrar-sala.html` (coluna "Sala cheia / link inválido").
- Se as duas causas de rejeição (sala inexistente vs. cheia) não puderem ser distinguidas de forma barata a partir do erro que o `joinById` rejeita, é aceitável mostrar uma única mensagem genérica cobrindo os dois casos — o próprio `EXPERIENCE.md` marca esse texto como `[ASSUMPTION]`, não uma exigência fechada.
- Visual segue `DESIGN.md`/`EXPERIENCE.md` e o mockup `mockups/key-entrar-sala.html`.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Mostrar o nome do host antes de entrar (o mockup tem uma linha "Você foi convidado pra sala de Mauricio", mas isso exigiria um mecanismo novo de metadata/preview de Room fora do contrato de mensagens fechado da AD-1 — fora de escopo; a tela vai direto pro formulário de nome).
- Qualquer lógica de jogo — Épico 2.
- Botão "Iniciar" ou atualização em tempo real além do que o `onStateChange` da Story 1.2 já entrega de graça — Story 1.4.
- Mudança em `PartidaRoom.ts` — este story não precisa tocar no backend.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Entrada válida | URL `/sala/{roomId-real}`, nome="Rafael" | `joinById` resolve, convidado vai pra Sala de Espera vendo host + a si mesmo | N/A |
| Sala inexistente | URL `/sala/{roomId-invalido}` | Formulário some, mensagem clara aparece | `joinById` rejeita a promise |
| Sala cheia | URL `/sala/{roomId-cheio}` (já no limite de `maxClients`) | Formulário some, mensagem clara aparece | `joinById` rejeita a promise |
| Nome vazio | nome="" | Botão "Entrar na Sala" permanece desabilitado | N/A (não chega a enviar) |
| URL sem `/sala/` | `/` ou qualquer outro path | Mostra `CriarSala` normalmente (comportamento já existente) | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/App.tsx` -- hoje só alterna `CriarSala`↔`SalaDeEspera` por estado local (Story 1.2); adicionar leitura de `window.location.pathname` pra decidir entre `CriarSala` e `EntrarSala` quando `room` ainda é `null`
- `frontend/src/client/colyseusClient.ts` -- Story 1.2 só tem `criarSala`; adicionar `entrarSala(nome, roomId)` chamando `client.joinById(roomId, { nome })`
- `frontend/src/screens/EntrarSala.tsx` -- novo, formulário (só nome, sem steppers) + estado de erro que substitui o formulário, visual conforme `mockups/key-entrar-sala.html`
- `frontend/src/screens/SalaDeEspera.tsx` -- sem mudança de código; reutilizado como está (Story 1.2), já reage a `room.state` via `onStateChange`
- `backend/src/rooms/PartidaRoom.ts` -- sem mudança; `onJoin` já serve tanto o auto-join do host (Story 1.2) quanto o join explícito do convidado (esta história)

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/client/colyseusClient.ts` -- adicionar `entrarSala(nome, roomId)` -- ponte de rede única pro intent (AD-10)
- [x] `frontend/src/screens/EntrarSala.tsx` -- formulário de nome + tratamento de erro (substitui o formulário pela mensagem) -- cobre a Matrix acima
- [x] `frontend/src/App.tsx` -- roteamento por `window.location.pathname` (`/sala/:roomId` → `EntrarSala`, resto → `CriarSala`) -- ativa o link de convite gerado na Story 1.2
- [x] `e2e/entrar-sala.spec.ts` (novo) -- fluxo real: cria sala numa aba/contexto, abre o link de convite noutro, entra como convidado, confirma que aparece na Sala de Espera de ambos -- cobre a linha "Entrada válida" da Matrix ponta a ponta
- [x] Teste de componente (`EntrarSala.test.tsx`) cobrindo nome vazio desabilitando o botão e o caminho de rejeição substituindo o formulário pela mensagem -- cobre as linhas "Nome vazio"/"Sala inexistente"/"Sala cheia" da Matrix
- [x] Teste de integração de Room -- decisão: **não duplicado**. `ColyseusTestServer.connectTo()` (`@colyseus/testing/src/TestServer.ts:63`) chama `this.sdk.joinById(...)` internamente -- é o mesmo caminho de código que `entrarSala()` do frontend usa. O teste já existente da Story 1.2 ("`maxClients` ... barra uma terceira conexão além das vagas humanas", `PartidaRoom.integration.test.ts:67`) já exercita esse `joinById` sendo rejeitado por sala cheia. Não há caminho de rejeição observável diferente entre `connectTo` e `joinById` direto que justifique um teste novo.

**Acceptance Criteria:**
- Given um link de convite válido, when abro o link, informo meu nome e confirmo, then entro na `PartidaRoom` correspondente via `joinById(roomId)` (AD-2) — nunca matchmaking genérico
- Given entrei com sucesso, when chego na Sala de Espera, then ela é visível pra mim e pros demais (host inclusive, via `onStateChange` já existente)
- Given um link de sala que não existe mais, ou uma sala já cheia, when tento entrar, then vejo uma mensagem clara ("Esta sala não existe mais" / "Esta sala já está cheia", ou uma mensagem genérica cobrindo os dois casos), sem travar

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `App.tsx` -- `roomIdConvite` agora passa por `decodeURIComponent(...)` antes de ser usado; um link com caracteres percent-encoded (colado de um app que escapa URLs) não gerava mais "sala não existe" por engano.
2. `PartidaRoom.integration.test.ts` -- o teste de `maxClients` agora também confere `.rejects.toThrow(/locked/i)`, não só que a promise rejeita; fecha o mapeamento que `EntrarSala.tsx` depende (texto "locked" -> mensagem de sala cheia) contra regressão silenciosa de texto na lib do Colyseus.
3. `entrar-sala.spec.ts` -- o teste de sala inexistente agora confere o texto exato da mensagem (`toHaveText`, não só `toBeVisible`); novo teste E2E enche uma sala real (`totalJogadores=2`) até o limite e confirma que um terceiro convidado vê "Esta sala já está cheia." contra o Colyseus de verdade (não mockado).
4. `EntrarSala.tsx` -- mensagens de erro ganharam um subtítulo (título + linha secundária menor, igual ao `msg-box` do mockup); `MENSAGEM_SALA_INEXISTENTE`/`MENSAGEM_SALA_CHEIA`/`MENSAGEM_GENERICA` viraram `{ titulo, subtitulo }`.
5. `EntrarSala.css` -- `.msg-box` ganhou cor de borda própria (`#A3392B`, igual ao mockup, em vez de reusar `--vermelho-pop`); `.wordmark` alinhado ao peso visual de `CriarSala.css` (`-webkit-text-stroke: 2.5px`, `text-shadow: 3px 3px 0`).
6. `App.routing.test.ts` (novo) -- cobre `ROTA_ENTRAR_SALA` (agora exportada de `App.tsx`) isoladamente: `/sala/abc123` e `/sala/abc123/` casam e capturam `abc123`; `/sala/`, `/sala/a/b`, `/` e `/outra-rota` não casam.

Efeito colateral encontrado ao verificar o item 3: o novo teste E2E de "sala cheia" (3 `BrowserContext` simultâneos) e o teste de "entrada válida" (que já existia) ficaram instáveis quando os 4 testes E2E da suite rodam em paralelo (2 workers) -- não por bug de lógica (confirmado rodando isolado com `--workers=1`: passa sempre), e sim porque a soma das esperas sequenciais desses dois testes multi-contexto pode ultrapassar o timeout padrão de teste do Playwright (30s) sob essa carga. Corrigido com `test.setTimeout(60_000)` nos dois testes multi-contexto e timeouts de asserção individuais alargados de 10s para 15s onde fazia sentido -- não é mudança de comportamento do produto, só folga de teste sob paralelismo pesado.

## Design Notes

O tratamento de erro aqui é deliberadamente diferente do `CriarSala` (que usa um `role="alert"` inline dentro do card, form continua visível): aqui a mensagem substitui o formulário inteiro, porque é assim que o mockup `key-entrar-sala.html` desenha o estado de erro (`msg-box` isolado, sem card de formulário). Não unificar os dois padrões nesta história.

Distinguir "sala inexistente" de "sala cheia" a partir do erro do `joinById` é best-effort: se o Colyseus expuser algo utilizável no objeto de erro (código, mensagem), use; senão, uma mensagem genérica cobrindo os dois é aceitável (ver Boundaries).

Achado na implementação: dá pra distinguir sim, de forma barata. `MatchMaker.joinById` (`@colyseus/core/build/MatchMaker.mjs`, não alterado por este story) lança `room "${roomId}" not found` quando o `roomId` não existe e `room "${roomId}" is locked` quando `maxClients` já foi atingido (a Room trava sozinha ao encher). As duas usam o mesmo `ErrorCode.MATCHMAKE_INVALID_ROOM_ID`, mas o texto da mensagem difere -- o SDK do cliente propaga essa mensagem em `MatchMakeError.message` (`@colyseus/sdk/src/Client.ts:417`). `EntrarSala.tsx` faz `match` nesses dois padrões (`/not found/i`, `/locked/i`) pra escolher a mensagem específica do mockup, com a mensagem genérica como fallback se o texto não bater com nenhum dos dois (ex.: falha de rede).

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: inclui os novos testes de componente do `EntrarSala`, tudo verde -- **verificado (pós-patch), 17/17 testes passando (4 arquivos: `Exemplo`, `CriarSala`, `EntrarSala`, `App.routing`)**
- `cd backend && npm run test:integration` -- expected: verde (com ou sem o teste adicional de `joinById` -- ver Tasks) -- **verificado (pós-patch), 4/4 passando, incluindo a nova asserção `.rejects.toThrow(/locked/i)`**; `npm test` (unitário) também verificado, 7/7 passando
- `npx playwright test` (raiz) -- expected: inclui o novo fluxo de dois clientes (host cria, convidado entra), tudo verde -- **verificado (pós-patch), 4/4 passando, em 3 execuções consecutivas da suite inteira** (fluxo de dois clientes, link inválido com texto exato, sala cheia de verdade com terceiro convidado rejeitado, além do E2E existente da Story 1.2) -- ver nota de estabilidade no Spec Change Log

**Manual checks (if no CLI):**
- Criar uma sala localmente, copiar o link exibido, abrir em outra aba (ou navegador anônimo), confirmar que entra como convidado e aparece na lista de ambas as telas. Tentar abrir um link com um `roomId` inventado e confirmar a mensagem de erro.
- Não executado manualmente nesta sessão -- a cobertura E2E acima (que sobe frontend+backend reais via Playwright) exercita exatamente esse fluxo automaticamente, incluindo o caso de `roomId` inventado e o de sala cheia.

## Suggested Review Order

**Ponte de rede do frontend (AD-2, AD-10)**

- Único ponto novo que dispara o intent `entrarSala` via `joinById` -- nunca matchmaking genérico.
  [`colyseusClient.ts:39`](../../frontend/src/client/colyseusClient.ts#L39)

**Tela Entrar na Sala**

- Formulário de nome + estado de erro (título + subtítulo) que substitui o formulário inteiro (não o padrão inline de `CriarSala`).
  [`EntrarSala.tsx:52`](../../frontend/src/screens/EntrarSala.tsx#L52)

- Heurística de distinção "sala inexistente" vs. "sala cheia" a partir da mensagem do `joinById`, com fallback genérico.
  [`EntrarSala.tsx:131`](../../frontend/src/screens/EntrarSala.tsx#L131)

**Roteamento**

- `window.location.pathname` decide entre `CriarSala` e `EntrarSala` quando ainda não há `room`; regex exportada (`ROTA_ENTRAR_SALA`) e `roomId` capturado passa por `decodeURIComponent` antes de virar prop.
  [`App.tsx:15`](../../frontend/src/App.tsx#L15) (regex)
  [`App.tsx:27`](../../frontend/src/App.tsx#L27) (componente + decode)

**Pirâmide de testes (AD-12)**

- Componente: nome vazio desabilita o botão; rejeição do `joinById` (sala inexistente, sala cheia, erro genérico) substitui o formulário pela mensagem, título + subtítulo conferidos.
  [`EntrarSala.test.tsx:24`](../../frontend/src/screens/EntrarSala.test.tsx#L24)

- Unitário: regex de roteamento `ROTA_ENTRAR_SALA` isolada, sem montar `App`.
  [`App.routing.test.ts`](../../frontend/src/App.routing.test.ts)

- E2E: fluxo real de dois contextos de browser (host cria, convidado abre o link, entra, ambos veem a Sala de Espera atualizada); link de sala inexistente com texto exato da mensagem; sala cheia de verdade (`totalJogadores=2`) rejeitando um terceiro convidado com o texto real "Esta sala já está cheia." (não mockado).
  [`entrar-sala.spec.ts:14`](../../e2e/entrar-sala.spec.ts#L14)
  [`entrar-sala.spec.ts:78`](../../e2e/entrar-sala.spec.ts#L78)
  [`entrar-sala.spec.ts:96`](../../e2e/entrar-sala.spec.ts#L96)

- Integração de Room: nenhum teste novo, mas o teste existente da Story 1.2 agora também confere o texto da rejeição (`.rejects.toThrow(/locked/i)`) -- ver nota na Task de execução acima (`connectTo` já é `joinById` por baixo).
  [`PartidaRoom.integration.test.ts:67`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L67)
