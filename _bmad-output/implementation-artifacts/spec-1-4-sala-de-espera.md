---
title: 'Sala de Espera'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
baseline_commit: 'ac75083a0d0942d4a5703bb6ed94e1c3ea17ecf8'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Sala de Espera (Story 1.2) hoje mostra só o snapshot do momento da criação. Quando alguém sai antes da Partida começar, continua aparecendo na lista pra sempre (`onLeave` só loga). E não existe nenhum jeito de o host efetivamente começar a Partida — sem botão "Iniciar".

**Approach:** Duas coisas independentes que fecham o loop da Sala de Espera: (1) `PartidaRoom.onLeave` passa a remover o `Jogador` correspondente de `EstadoPartida.jogadores` — como o `room.state` já é reativo (Story 1.2/1.3), a lista já atualiza sozinha assim que o campo muda, sem trabalho extra no frontend; (2) a Sala de Espera ganha o botão "Iniciar", visível só pro host, habilitado quando `jogadores.length >= 2`, que ao ser clicado dispara o intent `iniciarPartida` (AD-1). Este story só dispara o intent — a lógica de embaralhar/distribuir/transição de estado que ele desencadeia é do Épico 2, que ainda não existe; o servidor não precisa (nem deve) ter um handler pra essa mensagem ainda.

## Boundaries & Constraints

**Always:**
- `PartidaRoom.onLeave` remove o `Jogador` cujo `sessionId` bate com o cliente que saiu, de `EstadoPartida.jogadores` — vale pra qualquer saída durante a Sala de Espera (a Partida ainda não começou, não há Monte a preservar).
- Botão "Iniciar" só aparece pro Jogador cujo próprio `Jogador` (achado por `sessionId === room.sessionId`) tem `isHost: true`.
- Botão "Iniciar" habilitado quando `jogadores.length >= 2` (mínimo humanos+IA, já contando as vagas de IA populadas na criação — Story 1.2), desabilitado caso contrário — mesmo padrão visual/comportamental de `CriarSala`/`EntrarSala`.
- Ao clicar em "Iniciar" (só possível quando habilitado), disparar `room.send("iniciarPartida")` (AD-1) — via um wrapper novo em `colyseusClient.ts`, seguindo o padrão de `criarSala`/`entrarSala`.
- Nome de domínio em português nos identificadores (`iniciarPartida`), sem mudar nada do contrato de mensagens já fechado na AD-1.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Handler `onMessage("iniciarPartida", ...)` no backend, ou qualquer lógica de embaralhar/distribuir Cartas/transição de estado — pertence ao Épico 2 (AD-5), que ainda não existe. Este story só garante que o intent é disparado; o que acontece do lado do servidor ao recebê-lo é responsabilidade de uma história futura.
- Rede de segurança que converte vaga humana não preenchida em IA no início da Partida — isso é Épico 3 (Story 3.1), não este.
- Reatribuir host se quem sai for o próprio host — comportamento não especificado em nenhum FR/AC; a pessoa simplesmente some da lista como qualquer outra saída, sem lógica extra de promoção.
- Qualquer distinção entre saída limpa e desconexão abrupta (parâmetro `consented` do `onLeave`) — já registrado como item adiado desde a Story 1.1, continua fora de escopo aqui.
- Mudança em `criarSala`/`entrarSala` ou nas telas `CriarSala`/`EntrarSala` — este story mexe só em `PartidaRoom.onLeave` e em `SalaDeEspera`/`colyseusClient.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Convidado sai durante a espera | 2 clientes na Room (host + convidado), convidado desconecta | `jogadores` cai pra 1 entrada (host); lista do host atualiza em tempo real sem recarregar | N/A |
| Iniciar habilita com 2 | `jogadores.length` chega a 2 (host + 1 IA, ou host + 1 convidado) | Botão "Iniciar" (visível só pro host) fica habilitado | N/A |
| Iniciar desabilitado com 1 | Só o host na sala (`totalIA=0`, ninguém mais entrou) | Botão "Iniciar" (visível só pro host) permanece desabilitado | N/A |
| Convidado não vê "Iniciar" | Cliente cujo `Jogador` tem `isHost: false` | Nenhum botão "Iniciar" renderizado pra esse cliente | N/A |
| Clique em Iniciar | Host clica com o botão habilitado | `room.send("iniciarPartida")` é chamado — sem handler no servidor ainda (Épico 2) | N/A (fire-and-forget, sem resposta esperada nesta história) |

</frozen-after-approval>

## Code Map

- `backend/src/rooms/PartidaRoom.ts` -- `onLeave(client)` hoje só loga; adicionar remoção do `Jogador` correspondente de `this.state.jogadores`
- `frontend/src/screens/SalaDeEspera.tsx` -- já reativo a `room.state` via `onStateChange` (Story 1.2/1.3); adicionar o botão "Iniciar" condicionado a `meuJogador?.isHost`, habilitado por `jogadores.length >= 2`
- `frontend/src/client/colyseusClient.ts` -- Story 1.3 tem `criarSala`/`entrarSala`; adicionar `iniciarPartida(room)` chamando `room.send("iniciarPartida")`
- `frontend/src/screens/SalaDeEspera.css` -- adicionar estilo do botão "Iniciar" (reusar padrão `.btn-primario` já usado em `CriarSala.css`/`EntrarSala.css`, mas escopado como as outras telas)
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- adicionar teste de `onLeave` removendo o Jogador do estado

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- `onLeave` remove o `Jogador` de `state.jogadores` por `sessionId` -- efetiva a linha "Convidado sai durante a espera" da Matrix
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- teste de integração: dois clientes entram, um sai, confirma que só o outro resta em `state.jogadores`
- [x] `frontend/src/client/colyseusClient.ts` -- `iniciarPartida(room)` -- ponte de rede única pro intent (AD-10), mesmo padrão de `criarSala`/`entrarSala`
- [x] `frontend/src/screens/SalaDeEspera.tsx` + `.css` -- botão "Iniciar" visível só pro host, habilitado por `jogadores.length >= 2`, dispara `iniciarPartida(room)` ao clicar
- [x] Teste de componente (`SalaDeEspera.test.tsx`, novo) cobrindo: botão ausente pra não-host, desabilitado com 1 jogador, habilitado com 2+, `room.send` chamado ao clicar
- [x] `e2e/sala-de-espera.spec.ts` (novo) -- fluxo real: host cria sala com 1 IA (`totalIA=1`, `totalJogadores=2` -- já nasce com `jogadores.length=2`), confirma botão "Iniciar" habilitado; em outro teste, host + convidado, convidado sai (fecha a aba/contexto), confirma que a lista do host atualiza removendo o convidado

**Acceptance Criteria:**
- Given estou na Sala de Espera, when outro jogador entra ou sai, then a lista atualiza em tempo real, mostrando nome (humano) ou pílula "IA" (entrada já funciona desde a Story 1.2/1.3; esta história fecha a saída)
- Given sou o host, when o mínimo de 2 Jogadores totais (humanos + IA) é atingido, then o botão "Iniciar" fica habilitado
- Given não sou o host, when estou na Sala de Espera, then não vejo nenhum botão "Iniciar"

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `colyseusClient.test.ts` (novo) -- teste unitário de `iniciarPartida(room)` chamando `room.send("iniciarPartida")` num `room` falso; fecha o gap de o corpo real da função nunca ter rodado em nenhum teste (só mockada em `SalaDeEspera.test.tsx`).
2. `PartidaRoom.integration.test.ts` -- o teste de `onLeave` (2→1) trocou o `setTimeout(100)` fixo por `vi.waitFor(...)`, removendo o risco de flakiness sob carga.
3. `SalaDeEspera.tsx` -- botão "Iniciar" ganhou estado local (`enviado`) que desabilita após o primeiro clique, e a chamada de `iniciarPartida(room)` agora está em try/catch com `console.error`, mesmo padrão de `CriarSala.tsx`/`EntrarSala.tsx`.
4. `SalaDeEspera.test.tsx` -- novo teste de reatividade: muta `room.state.jogadores` e dispara o callback capturado de `onStateChange`, confirmando que o botão habilita de verdade (não só snapshots estáticos).
5. `sala-de-espera.spec.ts` -- primeiro teste agora confere que `total-jogadores` começa em "4" antes de clicar duas vezes em "Diminuir".
6. `PartidaRoom.integration.test.ts` -- novo teste de `onLeave` com 3 jogadores, removendo um do meio da lista (não host, não último) -- cobre o `findIndex`/`splice` por índice além do caso trivial 2→1.
7. `sala-de-espera.spec.ts` -- segundo teste agora fecha `contextoConvidado` também no `finally` (fechamento idempotente) se alguma asserção anterior ao `close()` intencional falhar, evitando vazamento de `BrowserContext`.

## Design Notes

`onLeave` remover o Jogador do array de Schema (`ArraySchema.splice` ou equivalente) é o suficiente pra Story 1.4: como o `SalaDeEspera` já escuta `room.onStateChange` (Story 1.2, corrigindo a race condition do snapshot inicial) e sempre lê `room.state` fresco a cada render, a remoção no servidor propaga pro cliente automaticamente — não precisa de nenhum evento novo nem mudança de listener no frontend.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: verde
- `cd backend && npm run test:integration` -- expected: inclui o novo teste de `onLeave`, tudo verde
- `cd frontend && npm test` -- expected: inclui os novos testes de componente do botão "Iniciar", tudo verde
- `npx playwright test` (raiz) -- expected: inclui o novo fluxo de habilitação do botão e de saída em tempo real, tudo verde

**Manual checks (if no CLI):**
- Criar uma sala com 2 jogadores/0 IA, abrir o link como convidado, confirmar que o botão "Iniciar" aparece só na tela do host e habilita quando o convidado entra; fechar a aba do convidado e confirmar que ele some da lista do host.

## Suggested Review Order

**Saída em tempo real no servidor**

- `onLeave` remove o Jogador que saiu do estado sincronizado -- a reatividade já existente (Story 1.2/1.3) propaga isso pro frontend sem nenhum código novo lá.
  [`PartidaRoom.ts:118`](../../backend/src/rooms/PartidaRoom.ts#L118)

**Botão Iniciar (só o host)**

- Deriva `souHost`/`podeIniciar` do próprio estado e renderiza o botão condicionalmente; clique protegido contra duplo-envio e falha silenciosa.
  [`SalaDeEspera.tsx:64`](../../frontend/src/screens/SalaDeEspera.tsx#L64)

- Único ponto que dispara o intent `iniciarPartida` -- fire-and-forget, sem handler no servidor ainda (Épico 2).
  [`colyseusClient.ts:54`](../../frontend/src/client/colyseusClient.ts#L54)

**Pirâmide de testes (AD-12)**

- Integração de Room: `onLeave` removendo o Jogador certo, tanto no caso simples (2→1) quanto removendo do meio de uma lista maior (3→2).
  [`PartidaRoom.integration.test.ts:1`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L1)

- Componente: visibilidade/habilitação do botão nos quatro cenários da Matrix, incluindo a reatividade de verdade (muta estado, dispara `onStateChange`, confirma o re-render).
  [`SalaDeEspera.test.tsx:51`](../../frontend/src/screens/SalaDeEspera.test.tsx#L51)

- Unitário: `iniciarPartida(room)` chamando `room.send` de verdade, não só mockado.
  [`colyseusClient.test.ts:13`](../../frontend/src/client/colyseusClient.test.ts#L13)

- E2E: habilitação do botão ao nascer a sala já com IA suficiente, e a lista do host encolhendo em tempo real quando o convidado sai.
  [`sala-de-espera.spec.ts:13`](../../e2e/sala-de-espera.spec.ts#L13)
  [`sala-de-espera.spec.ts:52`](../../e2e/sala-de-espera.spec.ts#L52)
