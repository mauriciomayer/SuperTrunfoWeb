---
title: 'Baralho, Distribuição e Minha Carta'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: '76c2f8fd7b9a3d89c6d4c16cc4c4f1673351e6ca'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O botão "Iniciar" (Story 1.4) já dispara `iniciarPartida`, mas o backend não tem handler nenhum pra essa mensagem — a Partida nunca sai da Sala de Espera. Não existe Carta, Monte, nem Mesa de Jogo.

**Approach:** Implementar o primeiro handler `onMessage("iniciarPartida", ...)` da `PartidaRoom`: valida (host, estado `AguardandoJogadores`, mínimo 2 jogadores), monta o Baralho de 32 Cartas a partir de `docs/carros_specs.csv`, embaralha, distribui pra cada Jogador (humano ou IA) respeitando a regra de sobra (AD-6), define o host como Jogador Inicial, e transiciona `EstadoPartida.estado` pra `AguardandoSelecao`. No frontend, a Sala de Espera dá lugar a uma Mesa de Jogo mínima (só leitura nesta história): cada Jogador vê a própria Carta do topo, e as Cartas dos oponentes aparecem como Carta (verso) — sem seleção de Atributo ainda, isso é da Story 2.2. O centro desta história é o anti-cheat real (AD-3): o Monte de cada Jogador nunca é serializado por inteiro pra quem não é o dono, via `StateView`/`@view()` do Colyseus — nunca só escondido na UI.

## Boundaries & Constraints

**Always:**
- `iniciarPartida` só é aceito quando `EstadoPartida.estado === "AguardandoJogadores"` e só do Jogador com `isHost: true` (mesma autoridade do servidor de sempre, AD-1) — servidor rejeita silenciosamente ou loga erro pra qualquer outra origem, nunca muta estado.
- Baralho: exatamente 32 Cartas lidas de `docs/carros_specs.csv` (ID, Grupo, Letra, SuperTrunfo, Pais, e os 7 Atributos numéricos da planilha) — sem duplicar esses dados em código, sem lib nova de parsing de CSV (arquivo pequeno e simples o bastante pra um parser manual).
- Embaralhamento aleatório (Fisher-Yates ou equivalente) antes de cada Partida; distribuição usa `cartasPorJogador = Math.floor(32 / n)`, `descartadas = 32 % n` (AD-6) — as descartadas nunca vão pro Monte de ninguém.
- Cada Jogador (humano ou IA) recebe um Monte -- uma lista ordenada de Cartas, convenção FIFO: índice 0 é sempre o topo (próxima a jogar); Cartas coletadas futuramente entram no fim da lista (fundo). Essa convenção vale pro resto do épico.
- `EstadoPartida` ganha um campo `estado` (string) representando o estado atual da máquina de estados (AD-5) — inicializado como `"AguardandoJogadores"` na criação da Room (Story 1.2, sem mudar o comportamento de nenhuma história anterior), e só este handler o move para `"AguardandoSelecao"`.
- Jogador Inicial = sempre o host (AD-5, confirmado) — `EstadoPartida` precisa expor de alguma forma quem é o Jogador da vez (`jogadorDaVez`), setado pro host ao fim da distribuição.
- Anti-cheat real (AD-3, NFR-3): o Monte completo de um Jogador nunca é serializado pra outro cliente, nem inspecionável via console/API -- usar `StateView`/`@view()` do `@colyseus/schema` (confirmado disponível na versão instalada: decorator `@view()` em campo de Schema + `client.view.add()/remove()` por cliente, ver Design Notes). Por padrão nenhum cliente vê o Monte alheio; a própria Carta do topo é visível só pro dono. Contagem de Cartas no Monte (não o conteúdo) pode ser pública.
- Frontend: nova tela "Mesa de Jogo" substitui a Sala de Espera quando `EstadoPartida.estado` deixa de ser `"AguardandoJogadores"` (mesmo padrão reativo via `room.onStateChange` já estabelecido). Mostra a própria Carta do topo (componente Carta, foto placeholder + bandeira + badge Grupo/Letra, sem faixa colorida nem nome do carro, conforme `DESIGN.md`) e as Cartas dos oponentes como Carta (verso) — sem nenhuma interação de jogo ainda.

**Ask First:**
- Se o mecanismo `StateView`/`@view()` não se comportar como documentado no `README.md` do `@colyseus/schema` instalado (ex: não suportar adicionar/remover visibilidade de um elemento individual de um `ArraySchema` do jeito esperado), parar e perguntar antes de inventar uma alternativa que enfraqueça o anti-cheat (nunca aceitar "esconder só na UI" como solução de contorno).

**Never:**
- Seleção de Atributo, revelação, comparação, Super Trunfo, Funil, eliminação, fim de jogo — Stories 2.2 a 2.6.
- Fotos reais dos carros — continuam placeholder (pendente do usuário, já registrado como Deferred na arquitetura).
- IA escolhendo Atributo de verdade ou qualquer decisão de jogo — Épico 3. Aqui a IA só recebe Monte como qualquer outro Jogador.
- Ordem de turno pra rodadas seguintes, ou a regra de desempate de múltiplas Cartas "A" (AD-8) — não avançam o turno nesta história, ficam pra Story 2.3/2.4 decidirem em cima da mesma lista de `jogadores`.
- Mudar `criarSala`/`entrarSala`/`onLeave` ou qualquer coisa da Sala de Espera/Criar Sala/Entrar na Sala — só o necessário pra adicionar `estado` default em `onCreate`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Iniciar com 2 jogadores | Host + 1 convidado, `iniciarPartida` enviado pelo host | Baralho embaralhado e distribuído (16 Cartas cada), `estado` vira `AguardandoSelecao`, `jogadorDaVez` = host | N/A |
| Iniciar com 3 jogadores (sobra) | Host + 2 outros (humanos/IA), `iniciarPartida` | 10 Cartas cada, 2 descartadas (AD-6) | N/A |
| Iniciar de quem não é host | Convidado (não-host) envia `iniciarPartida` | Estado não muda, nenhum Baralho é criado | Mensagem ignorada/rejeitada, sem crash |
| Iniciar fora de `AguardandoJogadores` | `iniciarPartida` enviado de novo depois que a Partida já começou | Estado não muda, Baralho não é recriado | Mensagem ignorada/rejeitada, sem crash |
| Visibilidade de Monte alheio | Cliente A tenta inspecionar o Monte completo do Cliente B (ex: via devtools/console no estado sincronizado) | Só a Carta do topo de B (quando aplicável) e a contagem de Cartas são visíveis — nunca o Monte inteiro de B | N/A |

</frozen-after-approval>

## Code Map

- `docs/carros_specs.csv` -- fonte dos dados do Baralho, já existe, não copiar pro backend
- `backend/src/game/baralho.ts` (novo) -- funções puras: `carregarBaralho()` (lê e parseia o CSV em 32 objetos `Carta`-shaped), `embaralhar()` (Fisher-Yates), `distribuir(cartas, n)` (aplica a regra de sobra AD-6, devolve os Montes)
- `backend/src/schema/Carta.ts` (novo) -- Schema: grupo, letra, pais, superTrunfo, e os 7 Atributos numéricos (nomes verbatim do Glossário/CSV)
- `backend/src/schema/Jogador.ts` -- hoje só tem `sessionId`/`nome`/`isHost`/`isIA`; adicionar `monte: ArraySchema<Carta>` (view-tagged, ver Design Notes)
- `backend/src/schema/EstadoPartida.ts` -- adicionar `estado: string` (default `"AguardandoJogadores"`) e `jogadorDaVez: string` (sessionId ou referência equivalente)
- `backend/src/rooms/PartidaRoom.ts` -- `onCreate` seta `estado` default; novo `onMessage("iniciarPartida", ...)` valida, monta o Baralho, distribui, aplica `StateView` por cliente, transiciona estado
- `frontend/src/screens/MesaDeJogo.tsx` (novo) -- tela mínima: própria Carta do topo + Cartas (verso) dos oponentes
- `frontend/src/components/Carta.tsx` (novo) -- Carta (frente): foto placeholder, bandeira, badge Grupo/Letra, moldura conforme `DESIGN.md` (dourada+selo se Super Trunfo)
- `frontend/src/components/CartaVerso.tsx` (novo) -- Carta (verso): sem nenhuma informação identificável
- `frontend/src/App.tsx` -- decide entre `SalaDeEspera` e `MesaDeJogo` a partir de `room.state.estado`

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/baralho.ts` -- `carregarBaralho`/`embaralhar`/`distribuir` puros, testáveis sem Room -- base de tudo
- [x] `backend/src/schema/Carta.ts` -- Schema da Carta
- [x] `backend/src/schema/Jogador.ts` -- adicionar `monte`
- [x] `backend/src/schema/EstadoPartida.ts` -- adicionar `estado`/`jogadorDaVez`
- [x] `backend/src/rooms/PartidaRoom.ts` -- `estado` default em `onCreate`; handler `iniciarPartida` completo com validação, distribuição e `StateView` por cliente -- efetiva toda a Matrix
- [x] `frontend/src/components/Carta.tsx` + `CartaVerso.tsx` + `MesaDeJogo.tsx` -- renderização somente leitura da mão distribuída
- [x] `frontend/src/App.tsx` -- roteamento por `room.state.estado`
- [x] Testes unitários (`backend/src/game/baralho.test.ts`) cobrindo `carregarBaralho` (32 Cartas, 1 Super Trunfo), `embaralhar` (não é identidade, mesma composição), `distribuir` (2/3/4 jogadores, sobra só em n=3)
- [x] Teste de integração de Room cobrindo a Matrix inteira: início válido, rejeição de não-host, rejeição de estado errado, e a visibilidade filtrada (cliente B nunca recebe o Monte completo de A no seu `room.state` local)

**Acceptance Criteria:**
- Given o host clicou "Iniciar", when a Partida começa, then o sistema instancia o Baralho de 32 Cartas com ID, Grupo, Atributos e a flag Super Trunfo de `docs/carros_specs.csv`
- Given o Baralho instanciado, when a distribuição ocorre, then as Cartas são embaralhadas aleatoriamente e distribuídas igualmente -- com 3 Jogadores, 10 cartas cada e 2 descartadas
- Given a distribuição concluída, when qualquer Jogador olha sua tela, then ele vê a própria Carta do topo do Monte, com foto/bandeira/badge Grupo-Letra, sem ver o Monte completo próprio ou alheio
- Given a distribuição concluída, when um Jogador olha os oponentes, then vê Carta (verso) sem nenhuma informação identificável

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `frontend/src/App.test.tsx` (novo) + `e2e/mesa-de-jogo.spec.ts` (novo) -- o achado mais importante da revisão: a troca `SalaDeEspera` → `MesaDeJogo` em `App.tsx` nunca era verificada por nenhum teste. Adicionado teste de componente (muta `room.state.estado`, dispara `onStateChange`, confirma a troca no DOM) e E2E real (dois jogadores humanos, clique de verdade em "Iniciar"). Verificado que o teste de componente falha de verdade invertendo a condição do ternário e revertendo.
2. `PartidaRoom.ts` -- `aoReceberIniciarPartida` ganhou uma terceira validação server-side: rejeita se `jogadores.length < MIN_JOGADORES` (reaproveitando a constante já existente) -- antes só o frontend impedia iniciar com menos de 2.
3. `PartidaRoom.ts` -- chama `this.lock()` após transicionar pra `AguardandoSelecao` -- fecha o buraco de um convidado entrar depois do início e ficar travado sem Monte nem `StateView`.
4. `PartidaRoom.ts` -- `embaralhar(carregarBaralho())`/`distribuir(...)` agora dentro de um try/catch, logando e retornando sem mutar estado em caso de falha.
5. `baralho.ts` -- `carregarBaralho` agora valida que cada linha tem o mesmo número de colunas do cabeçalho, e que exatamente 1 Carta tem `superTrunfo === true` -- protege contra edição futura do CSV quebrar isso silenciosamente.
6. `EstadoPartida.ts` -- `estado` ganhou o tipo TypeScript `EstadoPartidaFSM` (union dos 7 valores conhecidos), mantendo `@type("string")` no wire -- proteção de typo em tempo de compilação, sem custo de rede.
7. `PartidaRoom.ts` -- as duas rejeições esperadas (não-host, estado errado) agora logam `console.warn` em vez de `console.error`; só a falha real de construção do Baralho continua `console.error`.
8. `PartidaRoom.ts` -- log de sucesso agora inclui a quantidade de Cartas descartadas pela regra de sobra (AD-6).
9. `PartidaRoom.integration.test.ts` -- novos casos: 4 jogadores (divisão exata) através do pipeline real de Room/`StateView`, `room.locked` após o início (confirma o item 3), e rejeição com 1 jogador só (confirma o item 2).

## Design Notes

Mecanismo de `StateView` confirmado no `README.md` de `@colyseus/schema` (instalado, não é suposição): `@view() @type(...)` num campo de Schema marca ele como visível só pra quem tem acesso via `StateView`; por cliente, `client.view.add(instancia)` concede essa visibilidade, `client.view.remove(instancia)` revoga. Isso funciona em instâncias individuais (inclusive elementos de um `ArraySchema`), então dá pra conceder visibilidade só da Carta do topo de um Jogador (um elemento específico do `monte`) sem expor o array inteiro. `client.view` fica disponível no objeto `Client` do Colyseus quando o campo `view` é usado em algum lugar do schema.

Convenção do Monte (índice 0 = topo, novas Cartas coletadas vão pro fim) é uma decisão desta história que todo o resto do épico assume -- documentar isso claramente no código, não só aqui.

Ordem de turno pra rodadas seguintes (depois da primeira, que é sempre o host) não é decidida por esta história -- fica pras Stories 2.2/2.3 resolverem em cima da mesma lista `jogadores` já existente.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes unitários de `baralho.ts`, tudo verde -- **verificado (pós-patch), 20/20 passando**
- `cd backend && npm run test:integration` -- expected: inclui o novo teste de `iniciarPartida` (validação + distribuição + visibilidade filtrada), tudo verde -- **verificado (pós-patch), 17/17 passando**
- `cd frontend && npm test` -- expected: inclui testes de componente de `Carta`/`CartaVerso`, tudo verde -- **verificado (pós-patch), 40/40 passando, incluindo `App.test.tsx`** (confirmado que ele realmente falha se a lógica de troca de tela for invertida)
- `npx playwright test` (raiz) -- **verificado (pós-patch), 7/7 passando** -- a revisão pediu um E2E real cobrindo o clique em "Iniciar" (`mesa-de-jogo.spec.ts`), estendendo a cobertura original

**Manual checks (if no CLI):**
- Criar uma sala com 3 jogadores (2 humanos + 1 IA), clicar Iniciar, confirmar visualmente que cada tela mostra a própria Carta (frente) e as demais como Carta (verso), e que abrir o DevTools do navegador não expõe o Monte completo de ninguém no estado sincronizado.

## Suggested Review Order

**Anti-cheat real (o centro desta história, AD-3)**

- `monte` marcado `@view()` -- invisível por padrão pra todo mundo, inclusive o dono.
  [`Jogador.ts:32`](../../backend/src/schema/Jogador.ts#L32)

- Concessão de visibilidade: só a Carta do topo, só pro `Client` dono, via `StateView`.
  [`PartidaRoom.ts:142`](../../backend/src/rooms/PartidaRoom.ts#L142)

- Prova real (dois clientes de verdade, decodificação client-side): A nunca recebe o Monte de B, nem a Carta do topo dele -- só a contagem.
  [`PartidaRoom.integration.test.ts:144`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L144)

**Baralho: fonte de dados, embaralhamento, distribuição (AD-6)**

- `carregarBaralho`/`embaralhar`/`distribuir` -- puros, sem Room, com as validações adicionadas na revisão (colunas, Super Trunfo único).
  [`baralho.ts:42`](../../backend/src/game/baralho.ts#L42)

**Handler `iniciarPartida` (primeiro da Room)**

- Validação (host, estado, mínimo de jogadores), distribuição, `lock()`, transição de estado -- tudo num só handler.
  [`PartidaRoom.ts:93`](../../backend/src/rooms/PartidaRoom.ts#L93)

**Fio que liga tudo à tela (o gap mais crítico encontrado na revisão)**

- Troca `SalaDeEspera` → `MesaDeJogo` a partir de `room.state.estado` -- sem isso, nada do que o backend faz aparece pra ninguém.
  [`App.tsx:40`](../../frontend/src/App.tsx#L40)

- Teste que prova a troca de verdade (falha se o `? :` for invertido).
  [`App.test.tsx:75`](../../frontend/src/App.test.tsx#L75)

**Mesa de Jogo somente leitura**

- Própria Carta (frente) + Cartas (verso) dos oponentes.
  [`MesaDeJogo.tsx:49`](../../frontend/src/screens/MesaDeJogo.tsx#L49)

- Componente Carta: placeholder de foto, bandeira, badge Grupo/Letra, moldura dourada se Super Trunfo.
  [`Carta.tsx:57`](../../frontend/src/components/Carta.tsx#L57)

**Testes de ponta a ponta**

- Fluxo real: dois jogadores, clique de verdade em "Iniciar", ambos chegam na Mesa de Jogo.
  [`mesa-de-jogo.spec.ts:15`](../../e2e/mesa-de-jogo.spec.ts#L15)
