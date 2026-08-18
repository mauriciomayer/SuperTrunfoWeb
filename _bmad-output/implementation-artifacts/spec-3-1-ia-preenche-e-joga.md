---
title: 'IA Preenche e Joga'
type: 'feature'
created: '2026-08-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
baseline_commit: 'f9f3a96ac52f4ae0a5a76deaaba43926372afed0'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Vagas de IA (`Jogador.isIA`) existem desde a Story 1.2 e recebem Monte normalmente na distribuição (Story 2.1), mas nunca jogam de verdade -- não existe `decidirAtributoIA`, nem forma de uma vaga de IA disparar `jogarCarta` quando é a vez dela. Se uma IA vira `jogadorDaVez` hoje, a Partida trava pra sempre (nenhum Client real tem `sessionId` vazio). Além disso, se o host inicia a Partida com menos Jogadores humanos do que declarou na criação da sala, as vagas humanas não preenchidas simplesmente não existem -- a distribuição roda só entre quem já entrou, ignorando o total declarado.

**Approach:** Ao iniciar a Partida, qualquer vaga humana ainda não preenchida (além da IA já declarada na criação) vira IA automaticamente, antes da distribuição do Baralho. Sempre que `resolverRodada` transiciona `estado` pra `"AguardandoSelecao"` (vencedor de Rodada normal, ou preservado/avançado após um empate) com um `jogadorDaVez` que é IA, a jogada dela é decidida e aplicada de forma síncrona e in-process, na MESMA execução -- nenhuma outra mensagem é processada nesse meio-tempo (garantido pelo próprio modelo de execução single-thread do Node/Colyseus, desde que nada ceda o event loop entre a transição e a jogada). A jogada da IA passa pela MESMA lógica de mutação que `jogarCarta` de um humano usaria (extraída pra um método compartilhado), nunca um caminho de mutação separado.

## Boundaries & Constraints

**Always:**
- `PartidaRoom.aoReceberIniciarPartida`: depois da validação de `MIN_JOGADORES`, antes de embaralhar/distribuir, se `this.state.jogadores.length < this.state.totalJogadoresDeclarado`, cria `Jogador`s adicionais (`isIA = true`, nomeados `"IA N"` continuando a numeração a partir de `totalIADeclarado + 1`) pro shortfall, e atualiza `totalIADeclarado` pra refletir o total real.
- `backend/src/game/ia.ts` (novo): `decidirAtributoIA(carta: Carta): string`, pura -- escolhe uma `chave` aleatória entre as 7 de `ATRIBUTOS` (`atributos.ts`). Nunca avalia odds nem Cartas de oponentes (sem oponentes visíveis antes da revelação de qualquer jeito) -- estratégia deliberadamente simples.
- `PartidaRoom.aoReceberJogarCarta`: extrai a lógica de mutação (tudo depois das checagens de `sessionId`/vez/`estado`) pra um método privado novo, `processarJogada(remetente: Jogador, mensagem?: OpcoesJogarCarta)` -- o handler de mensagem real passa a só validar e delegar pra ele.
- `PartidaRoom.resolverRodada`: ao final de CADA branch que efetivamente transiciona `estado` pra `"AguardandoSelecao"` (vencedor sem empate; empate com `jogadorDaVez` preservado ou avançado -- nunca nos branches de `FimDePartida`/degenerado): se o `Jogador` referenciado por `rodadaAtual.jogadorDaVez` tiver `isIA === true`, dispara a jogada dele na mesma execução -- `decidirAtributoIA(jogadorIA.monte[0])` se a Carta do topo NÃO for a Super Trunfo, `undefined` se for (reaproveita o branch `ehSuperTrunfo` já existente em `processarJogada`, sem duplicar) -- chamando `processarJogada` DIRETO com o objeto `Jogador` já resolvido, nunca relookup por `sessionId` (assentos de IA compartilham `sessionId === ""`, achado já documentado em `deferred-work.md`).

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Story 3.2 (continuidade por desconexão/takeover) -- fora de escopo desta história.
- Qualquer indicador de "IA pensando" no frontend -- não é pedido, e a Mesa de Jogo já mostra "Aguardando {nome} escolher…" genericamente pra qualquer `jogadorDaVez` que não seja o próprio Client (IA ou humano), sem precisar saber a diferença.
- Qualquer mudança de frontend -- consequência direta do item acima: a jogada da IA passa pelos MESMOS handlers/transições que uma jogada humana, então tudo que a Mesa de Jogo já renderiza (revelação, pausa, resultado, Funil, eliminação) já cobre o caso de IA sem código novo.
- Atraso/pausa NOVA do lado do servidor pra "esperar a IA decidir" -- a decisão é aplicada na mesma execução; a pausa de revelação (`DURACAO_REVELACAO_MS`) já existente e reaproveitada é a única pausa, igual a uma jogada humana.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vaga humana não preenchida no início | Host inicia a Partida com menos Jogadores conectados do que `totalJogadoresDeclarado` | Vaga(s) restante(s) viram IA automaticamente antes da distribuição; todos (incluindo a IA nova) recebem Monte normalmente | N/A |
| IA vence Rodada e vira a vez | `resolverRodada` (sem empate) transiciona `jogadorDaVez` pra uma IA | `decidirAtributoIA` dispara na mesma execução; a jogada segue o fluxo normal (Revelando, pausa, resolve) | N/A |
| IA da vez com Super Trunfo no topo | `jogadorDaVez` é IA e a própria Carta do topo dela é a Super Trunfo | `atributo` é ignorado automaticamente (branch `ehSuperTrunfo` já existente), `decidirAtributoIA` nem é chamada | N/A |
| IAs consecutivas | Os únicos Jogadores ativos restantes são todos IA (ex: últimos 2 numa Partida de 4) | As jogadas encadeiam automaticamente, cada uma com a mesma pausa de revelação, sem travar nem pular ninguém | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/game/ia.ts` (novo) -- `decidirAtributoIA`, pura
- `backend/src/rooms/PartidaRoom.ts`:
  - `aoReceberIniciarPartida` -- preenche vagas humanas faltantes com IA antes de `embaralhar`/`distribuir`
  - `aoReceberJogarCarta` -- extrai a mutação pra `processarJogada(remetente, mensagem)`
  - `resolverRodada`, os dois branches que chegam em `"AguardandoSelecao"` -- dispara `processarJogada` pra IA quando `jogadorDaVez` resolve pra um Jogador `isIA`

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/ia.ts` -- `decidirAtributoIA` pura, sempre devolve uma das 7 chaves válidas de `ATRIBUTOS`
- [x] `backend/src/rooms/PartidaRoom.ts` -- vaga humana faltante vira IA no início; `processarJogada` extraído e reaproveitado; disparo de IA nos dois branches de `resolverRodada` -- efetiva toda a Matrix
- [x] Testes unitários (`ia.test.ts`) -- `decidirAtributoIA` sempre devolve chave válida (rodar muitas vezes / mockar `Math.random`)
- [x] Teste de integração de Room -- Matrix inteira (vaga vira IA no início, IA vence e joga sozinha, IA com Super Trunfo, IAs consecutivas encadeando) via `@colyseus/testing`, incluindo confirmar que NENHUMA mensagem `jogarCarta` precisa ser enviada por nenhum Client pra a Partida continuar quando só sobra IA
- [x] (achado da revisão, fora do Code Map original) `sessionId` sintético único por vaga de IA -- elimina o crash de Super Trunfo e a atribuição errada de vencedor entre 2+ IAs

**Acceptance Criteria:**
- Given o host inicia a Partida, when alguma vaga humana ainda não foi preenchida (além da IA já declarada na criação da sala), then essa vaga também vira IA automaticamente
- Given é a vez de um Jogador controlado por IA, when a máquina de estados entra em `AguardandoSelecao` para esse assento, then `decidirAtributoIA` é chamada síncrona e in-process, e o resultado é aplicado atomicamente na mesma transição -- nenhuma outra mensagem é processada nesse meio-tempo

## Design Notes

A garantia de "nenhuma outra mensagem processada no meio-tempo" (AD-4) não precisa de nenhum lock/mutex explícito -- vem de graça do modelo de execução single-thread do Node/Colyseus: contanto que `processarJogada` seja chamada de forma síncrona (sem `await`/yield) dentro do mesmo callback que setou `estado = "AguardandoSelecao"`, nenhuma outra mensagem da Room consegue intercalar. O `this.clock.setTimeout` que `processarJogada` agenda pra si mesma (pausa de revelação) roda como um callback FUTURO e independente -- não quebra essa garantia, só encadeia a próxima jogada (de IA ou aguardando humano) do mesmo jeito que já acontece hoje.

`processarJogada` nunca precisa saber se `remetente` é IA ou humano -- os dois casos já convergem no mesmo objeto `Jogador` e no mesmo fluxo (StateView, `cartasEmDisputa`, transição de estado, agendamento da pausa). A única decisão específica de IA é QUAL `atributo` mandar, resolvida ANTES de chamar `processarJogada`, nunca dentro dela.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes de `ia.ts`, tudo verde -- **verificado, 65/65 passando**
- `cd backend && npm run test:integration` -- expected: inclui a Matrix inteira de IA (preenchimento de vaga, jogada automática, Super Trunfo, encadeamento), tudo verde -- **verificado (pós-patch), 42/42 passando, rodado 2x seguidas sem flake**
- `cd frontend && npm test` -- expected: sem regressão (nenhuma mudança de frontend nesta história) -- **verificado, 98/98 passando, zero arquivo de frontend tocado**
- `npx playwright test` (raiz) -- expected: sem regressão na suite existente -- **verificado com ressalva: rodado 6x seguidas (`--workers=1`), 5 falhas em testes DIFERENTES a cada vez (`criar-sala`/`entrar-sala`/`sala-de-espera`/`mesa-de-jogo`, nenhum relacionado a IA), cada uma confirmada como flake ambiental já documentado nesta sessão (servidor backend confirmado subindo limpo e rápido isoladamente; snapshot de erro mostrando "Carregando sala…" ainda pendente após 15s, round-trip do snapshot inicial sob carga -- mesmo padrão já aceito em Stories anteriores). Nenhuma falha ocorreu em nenhum teste que toca IA/`iniciarPartida`/`resolverRodada`.

**Manual checks (if no CLI):**
- Criar uma sala com 1 IA declarada + 1 vaga humana, mas só o host entrar antes de clicar "Iniciar" -- confirmar que a Partida começa mesmo assim (a vaga extra virou IA) e que, quando chega a vez de uma IA, a Rodada resolve sozinha sem ninguém clicar em nada.

## Suggested Review Order

**Identidade das vagas de IA -- a correção que a revisão exigiu**

- `sessionId` sintético único (`"ia-N"`) por vaga de IA -- raiz da correção que elimina o crash e a atribuição errada de vencedor entre 2+ IAs (achado da revisão independente, não previsto no Code Map original).
  [`PartidaRoom.ts:145`](../../backend/src/rooms/PartidaRoom.ts#L145)
  [`PartidaRoom.ts:250`](../../backend/src/rooms/PartidaRoom.ts#L250)

**Preenchimento de vaga no início**

- Vaga humana faltante vira IA antes de embaralhar/distribuir.
  [`PartidaRoom.ts:240`](../../backend/src/rooms/PartidaRoom.ts#L240)

**Jogada automática de IA**

- `processarJogada` -- lógica de mutação extraída, reaproveitada tanto pela mensagem real quanto pelo disparo automático.
  [`PartidaRoom.ts:392`](../../backend/src/rooms/PartidaRoom.ts#L392)

- `despacharJogadaDeIA` -- decide (ou ignora, se Super Trunfo) e aplica a jogada da IA na mesma execução síncrona.
  [`PartidaRoom.ts:986`](../../backend/src/rooms/PartidaRoom.ts#L986)

- `decidirAtributoIA` -- escolha aleatória pura entre as 7 chaves válidas.
  [`ia.ts:29`](../../backend/src/game/ia.ts#L29)

**Testes**

- Matrix inteira via Room real, incluindo o teste que reproduz o crash original até o fim (não só até `SuperTrunfoAcionado`) e o que prova o vencedor correto entre 2 IAs pelo valor real da Carta.
  [`PartidaRoom.integration.test.ts:2261`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2261)
  [`PartidaRoom.integration.test.ts:2385`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2385)

- `decidirAtributoIA` isolada -- distribuição, valores de contorno, independência da própria Carta.
  [`ia.test.ts`](../../backend/src/game/ia.test.ts)
