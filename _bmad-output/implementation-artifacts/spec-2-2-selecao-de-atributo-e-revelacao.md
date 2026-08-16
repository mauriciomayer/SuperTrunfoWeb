---
title: 'Seleção de Atributo e Revelação'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: '9f720c617882d4a7d1d5bd7ae8de92b4fd7f0632'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depois da distribuição (Story 2.1), a Partida fica parada em `AguardandoSelecao` — não existe handler pra `jogarCarta`, e a Mesa de Jogo não deixa ninguém clicar em nada.

**Approach:** Implementar `onMessage("jogarCarta", ...)`: só aceita do Jogador da vez, só em `AguardandoSelecao`, valida o Atributo escolhido contra a config estática de `backend/src/game/atributos.ts` (AD-7, nova nesta história). Ao aceitar, monta `EstadoPartida.rodadaAtual` (schema `Rodada`, forma exata do AD-5: `jogadorDaVez`, `atributoSelecionado`, `cartasEmDisputa`), concede via `StateView` a Carta do topo de **todos** os Jogadores ativos pra **todo mundo** (não só o dono — é assim que a revelação simultânea funciona, mesmo mecanismo anti-cheat da Story 2.1, só que temporariamente mais aberto) e transiciona pra `Revelando`. No frontend, a Linha de Atributo da própria Carta vira clicável só na minha vez, e a Mesa de Jogo passa a mostrar a Carta (frente) de qualquer oponente cujo topo o servidor liberou — nunca decidindo isso pela UI, só renderizando o que já chegou (ou não) no estado local. Esta história para em `Revelando`; comparar valores, declarar vencedor e coletar Cartas é da Story 2.3.

## Boundaries & Constraints

**Always:**
- `backend/src/game/atributos.ts` (novo, AD-7): lista estática dos 7 Atributos com `chave` (mesmo nome de campo de `Carta`, ex: `velocidadeMaxima`), `rotulo` (exibição) e `inverso: boolean` — só `aceleracao` é `inverso: true`; usada tanto pra validar o `atributo` recebido em `jogarCarta` quanto (em Stories futuras) pra comparação.
- Novo Schema `Rodada` (`backend/src/schema/Rodada.ts`): `jogadorDaVez: string`, `atributoSelecionado: string`, `cartasEmDisputa: ArraySchema<Carta>` (forma exata do AD-5). `EstadoPartida` ganha `rodadaAtual: Rodada`. O `jogadorDaVez` que hoje mora solto em `EstadoPartida` (Story 2.1) migra pra dentro de `rodadaAtual` — é o mesmo dado, na forma que a arquitetura já tinha decidido; nada no frontend depende do lugar antigo ainda (confirmar antes de mexer).
- `jogarCarta` só é aceito do Jogador cujo `sessionId` bate com `rodadaAtual.jogadorDaVez` (equivalente ao antigo `EstadoPartida.jogadorDaVez`), e só quando `estado === "AguardandoSelecao"` — mesma autoridade de servidor de sempre (AD-1); qualquer outra origem é rejeitada (log + `return`, nunca muta estado).
- `atributo` é obrigatório nesta história (Super Trunfo, que tornaria opcional, é Story 2.4 — ver Never) e precisa ser uma `chave` válida de `atributos.ts`; inválido/ausente é rejeitado do mesmo jeito.
- Ao aceitar: preenche `rodadaAtual.atributoSelecionado` e `rodadaAtual.cartasEmDisputa` (a Carta do topo de cada Jogador ativo — nesta história, "ativo" = todo `jogadores`, ninguém foi eliminado ainda, isso é Story 2.6); concede `StateView` da Carta do topo de cada Jogador ativo pra **todo `Client` conectado** (não só o dono — mesmo `client.view.add()` da Story 2.1, chamado agora pra cada combinação cliente×Jogador ativo); transiciona `estado` pra `"Revelando"`.
- Frontend: Linha de Atributo (dentro do componente `Carta`) fica clicável só quando `estado === "AguardandoSelecao"` e `jogadorDaVez` (via `rodadaAtual`) é o próprio `room.sessionId` — clique único dispara `jogarCarta({ atributo: chave })`, sem confirmação intermediária (UX-DR4). Fora da própria vez, a Linha de Atributo nunca é clicável, nem na própria Carta.
- Frontend: um oponente aparece como `Carta` (frente) em vez de `CartaVerso` sempre que `oponente.monte?.[0]` estiver presente no estado local — nunca uma decisão de "estamos em Revelando" tomada no cliente; só reflete o que o `StateView` do servidor já concedeu (mesmo princípio anti-cheat de nunca decidir no frontend).
- Frontend: quando `estado === "AguardandoSelecao"` e não é minha vez, mostro "Aguardando {nome do Jogador da vez} escolher…" (Padrões de Estado).
- Teto de desempenho (NFR-1, 1,5s) satisfeito por construção — toda a lógica do handler é síncrona e local, sem I/O (mesmo raciocínio do AD-5); não precisa de teste de tempo dedicado.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Comparação de valores, declarar vencedor, coletar Cartas, passar a vez — Story 2.3. Esta história termina em `Revelando`, sem lógica nenhuma de "o que acontece depois".
- Exceção do Super Trunfo (`atributo` opcional, vitória automática) — Story 2.4. Mesmo que a Carta do topo de alguém seja a `2A`, esta história trata como qualquer outra Carta: `atributo` continua obrigatório.
- Funil, empate, eliminação, fim de jogo — Stories 2.5/2.6. `EstadoPartida.funil` não é criado nesta história.
- Revogar a visibilidade concedida ao entrar em `Revelando` — quem tira o `StateView` de volta (ao avançar pra próxima Rodada) é a Story 2.3, junto com a lógica de "o que acontece depois" da comparação.
- Mudar `criarSala`/`entrarSala`/`onLeave`, ou qualquer coisa de `CriarSala`/`EntrarSala`/`SalaDeEspera` — só o necessário em `PartidaRoom.ts`/`EstadoPartida.ts` pra suportar `rodadaAtual`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seleção válida | Jogador da vez envia `jogarCarta({ atributo: "velocidadeMaxima" })` em `AguardandoSelecao` | `rodadaAtual` preenchido, todos os Jogadores ativos ficam com a Carta do topo visível pra todo mundo, `estado` vira `Revelando` | N/A |
| Seleção de quem não é o Jogador da vez | Outro Jogador envia `jogarCarta` | Nada muda | Rejeitado, sem crash |
| Seleção fora de `AguardandoSelecao` | `jogarCarta` enviado durante `Revelando` (ex: clique duplo) | Nada muda | Rejeitado, sem crash |
| Atributo inválido | `jogarCarta({ atributo: "potenciaDoMotorInventada" })` do Jogador da vez | Nada muda | Rejeitado, sem crash |
| Atributo ausente | `jogarCarta({})` do Jogador da vez, carta do topo não é Super Trunfo | Nada muda (obrigatório nesta história) | Rejeitado, sem crash |

</frozen-after-approval>

## Code Map

- `backend/src/game/atributos.ts` (novo) -- config estática dos 7 Atributos (`chave`/`rotulo`/`inverso`, AD-7)
- `backend/src/schema/Rodada.ts` (novo) -- Schema: `jogadorDaVez`, `atributoSelecionado`, `cartasEmDisputa: ArraySchema<Carta>`
- `backend/src/schema/EstadoPartida.ts` -- adicionar `rodadaAtual: Rodada`; remover o `jogadorDaVez` solto (migra pra dentro de `rodadaAtual`), adicionar `"jogarCarta"` como estado que a máquina aceita (comentário já lista os nomes)
- `backend/src/rooms/PartidaRoom.ts` -- `aoReceberIniciarPartida` passa a setar `rodadaAtual.jogadorDaVez` (em vez do campo antigo); novo `onMessage("jogarCarta", ...)` com toda a validação + concessão de `StateView` pra todos + transição
- `frontend/src/components/Carta.tsx` -- Linha de Atributo vira condicionalmente clicável (`clicavel`/`onSelecionarAtributo`), com `atributoDestacado` opcional pra Story 2.3 destacar depois (aqui só recebe a prop, sem uso visual ainda além do clique)
- `frontend/src/client/colyseusClient.ts` -- novo `jogarCarta(room, atributo)` chamando `room.send("jogarCarta", { atributo })`, mesmo padrão de `iniciarPartida`
- `frontend/src/screens/MesaDeJogo.tsx` -- oponente vira `Carta` (frente) quando `monte?.[0]` existir; mensagem "Aguardando X escolher…" fora da própria vez; passa `clicavel`/`onSelecionarAtributo` pra própria Carta quando for minha vez

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/atributos.ts` -- config dos 7 Atributos (AD-7) -- base da validação
- [x] `backend/src/schema/Rodada.ts` -- Schema novo
- [x] `backend/src/schema/EstadoPartida.ts` -- `rodadaAtual`, remoção do `jogadorDaVez` solto
- [x] `backend/src/rooms/PartidaRoom.ts` -- `aoReceberIniciarPartida` atualizado + novo handler `jogarCarta` completo -- efetiva toda a Matrix
- [x] `frontend/src/client/colyseusClient.ts` -- `jogarCarta(room, atributo)`
- [x] `frontend/src/components/Carta.tsx` -- Linha de Atributo clicável condicional
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- oponentes revelados quando aplicável, mensagem de espera, disparo do clique
- [x] Testes unitários (`backend/src/game/atributos.test.ts`) cobrindo a config (7 entradas, só 1 inversa)
- [x] Teste de integração de Room cobrindo a Matrix inteira: seleção válida (com verificação de que TODOS os clientes recebem a Carta do topo de TODOS depois do `jogarCarta`, não só a própria), rejeição de não-é-a-vez, rejeição de estado errado, rejeição de atributo inválido/ausente
- [x] Teste de componente (`Carta.test.tsx`) cobrindo clique disparando `onSelecionarAtributo` só quando `clicavel`
- [x] `e2e/mesa-de-jogo.spec.ts` estendido (ou novo teste no mesmo arquivo) -- fluxo real: host seleciona um Atributo, ambos os jogadores veem as duas Cartas reveladas

**Acceptance Criteria:**
- Given sou o Jogador da vez, when clico numa Linha de Atributo da minha Carta, then o sistema aceita só Atributos presentes na minha Carta do topo
- Given o Atributo foi selecionado, when a seleção é aceita, then as Cartas do topo de todos os Jogadores ativos viram simultaneamente, revelando o valor desse Atributo pra todo mundo
- Given não sou o Jogador da vez, when a Partida está em `AguardandoSelecao`, then não vejo nenhuma Linha de Atributo clicável, nem na minha própria Carta

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `PartidaRoom.integration.test.ts` -- "seleção válida" ganhou asserções de `rodadaAtual.atributoSelecionado`/`cartasEmDisputa` via `host.state`/`convidado.state` (não só `room.state`) -- mesma classe de bug que o `clonarCarta` já corrigiu, agora fechada nesses dois campos também.
2. `Carta.tsx` -- `onKeyDown` ignora `evento.repeat`, evitando disparos repetidos ao segurar Enter/espaço.
3. `PartidaRoom.ts` -- os dois `if (!cartaTopo) return;` de `aoReceberJogarCarta` agora logam `console.warn` identificando o Jogador pulado.
4. `Rodada.ts` -- `cartasEmDisputa` marcada `@view()` (mesmo padrão de `Jogador.monte`) -- antes transmitia dados completos das Cartas em disputa pra todo cliente sem filtro nenhum, mesmo sem ninguém lendo esse campo ainda.
5. `PartidaRoom.test.ts` -- novo teste unitário pra `clonarCarta`: identidade de objeto diferente + igualdade de valor campo a campo (iterando os campos via `Metadata.getFields(Carta)`, à prova de `Carta.ts` ganhar campo novo).
6. `Carta.css` -- removido o `outline: none` que sobrescrevia o piso de acessibilidade já estabelecido (foco visível global) só pra Linha de Atributo clicável.
7. `PartidaRoom.integration.test.ts` -- novo teste travando que `jogarCarta` continua exigindo `atributo` mesmo com a Carta do topo sendo a Super Trunfo (`2A`) -- guarda o Boundaries "Never" desta história contra a exceção da Story 2.4 vazar sem querer.

## Design Notes

Migrar `jogadorDaVez` de `EstadoPartida` direto pra dentro de `rodadaAtual` (em vez de manter os dois) segue a forma de schema que o AD-5 já tinha fechado ("`EstadoPartida.rodadaAtual` é um objeto `{ jogadorDaVez, ... }`") — a Story 2.1 colocou solto porque `rodadaAtual` ainda não existia; agora que existe, não faz sentido manter duplicado. Como nada no frontend lê `jogadorDaVez` hoje (só está declarado no tipo espelho, sem uso visual — ver comentário em `MesaDeJogo.tsx`), a migração é segura.

A concessão de `StateView` na revelação é o mesmo mecanismo da Story 2.1 (`client.view.add()`), só que iterando por **todos** os Clientes × **todos** os Jogadores ativos, em vez de só o próprio dono. Não precisa de nenhuma API nova do Colyseus — só mais chamadas do que já existe.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes de `atributos.ts`, tudo verde -- **verificado (pós-patch), 30/30 passando**
- `cd backend && npm run test:integration` -- expected: inclui o novo teste de `jogarCarta` (validação + revelação pra todos), tudo verde -- **verificado (pós-patch), 23/23 passando**
- `cd frontend && npm test` -- expected: inclui o novo teste de clique em `Carta.test.tsx`, tudo verde -- **verificado (pós-patch), 51/51 passando**
- `npx playwright test` (raiz) -- expected: inclui o fluxo estendido de seleção+revelação, tudo verde -- **verificado (pós-patch), 8/8 passando**

**Manual checks (if no CLI):**
- Criar uma sala com 2 jogadores humanos, iniciar a Partida, o host clica num Atributo -- confirmar que as duas telas mostram as duas Cartas reveladas (frente), e que o convidado não conseguia clicar em nada antes disso.

## Suggested Review Order

**Handler `jogarCarta` e a revelação multi-cliente**

- As três validações (vez, estado, atributo), montagem de `rodadaAtual`, e concessão de `StateView` pra todos -- o núcleo desta história.
  [`PartidaRoom.ts:272`](../../backend/src/rooms/PartidaRoom.ts#L272)

- `clonarCarta` -- por que uma instância de Schema não pode viver em dois campos ao mesmo tempo (bug real encontrado e corrigido nesta história).
  [`PartidaRoom.ts:20`](../../backend/src/rooms/PartidaRoom.ts#L20)

- `atributos.ts` -- config estática dos 7 Atributos (AD-7), base da validação.
  [`atributos.ts:19`](../../backend/src/game/atributos.ts#L19)

- `Rodada` -- forma exata do AD-5, `cartasEmDisputa` marcada `@view()` por postura padrão-segura.
  [`Rodada.ts:24`](../../backend/src/schema/Rodada.ts#L24)

**Prova de ponta a ponta (o mesmo bug que já apareceu uma vez)**

- Verificação via estado decodificado de dois clientes reais, não só o servidor.
  [`PartidaRoom.integration.test.ts:406`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L406)

- Teste do `clonarCarta` isolado (identidade + valores).
  [`PartidaRoom.test.ts:60`](../../backend/src/rooms/PartidaRoom.test.ts#L60)

**Frontend: clique e revelação reativa**

- Linha de Atributo condicionalmente clicável (com guarda de `repeat` do teclado).
  [`Carta.tsx`](../../frontend/src/components/Carta.tsx)

- Oponente vira carta-frente automaticamente quando o servidor libera -- nunca uma decisão da UI.
  [`MesaDeJogo.tsx`](../../frontend/src/screens/MesaDeJogo.tsx)

**E2E**

- Fluxo real: seleção de Atributo, ambos os jogadores veem as duas Cartas reveladas.
  [`mesa-de-jogo.spec.ts:99`](../../e2e/mesa-de-jogo.spec.ts#L99)
