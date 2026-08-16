---
title: 'Comparação, Vencedor e Próxima Rodada'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: 'f91304ede7273b5f98f94387cb0e98dc8b5ab96c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depois da revelação (Story 2.2), a Partida fica parada em `Revelando` pra sempre — ninguém compara nada, ninguém coleta Carta, a próxima Rodada nunca começa.

**Approach:** Ao entrar em `Revelando`, agendar (via `this.clock.setTimeout`, Colyseus embutido) uma pausa fixa de 2,5s antes de resolver — tempo real pra revelação aparecer em rede antes do resultado (decisão do usuário: sem essa pausa, `Revelando` nunca chega a existir de verdade num patch de rede, e a animação combinada na UX não tem como acontecer). Ao resolver: compara o Atributo escolhido nas Cartas do topo de cada Jogador ativo (maior vence, exceto Atributo inverso), o vencedor leva todas as Cartas jogadas pro fundo do próprio Monte, vira o Jogador da próxima Rodada, e o estado volta pra `AguardandoSelecao` — com `StateView` revogada das Cartas da Rodada que passou e concedida de novo pro novo topo de cada Jogador ativo. Empate não é resolvido aqui (Story 2.5): só estaciona em `Funil`, sem lógica nenhuma além disso.

## Boundaries & Constraints

**Always:**
- Ao transicionar pra `"Revelando"` (final do handler `jogarCarta`, Story 2.2), agendar `resolverRodada()` via `this.clock.setTimeout(..., DURACAO_REVELACAO_MS)` — constante nomeada e exportada (2.500ms), não espalhada em número mágico.
- `resolverRodada()` opera direto em `state.jogadores`/`jogador.monte[0]` pra tudo — nunca em `rodadaAtual.cartasEmDisputa` (que é só o retrato de schema do AD-5, sem associação confiável de dono se algum Jogador tiver ficado sem Carta no meio do caminho).
- `backend/src/game/comparacao.ts` (novo): função pura `determinarVencedor(candidatos, atributo, inverso)` — recebe `{ sessionId, carta }[]`, devolve o `sessionId` vencedor ou sinaliza empate; maior valor vence, exceto quando `inverso` (só Aceleração, AD-7), onde vence o menor.
- Sem empate: o vencedor recebe TODAS as Cartas jogadas na Rodada (a própria incluída) no fundo do próprio Monte (índice final, convenção FIFO da Story 2.1) — removidas (nunca clonadas, mover a instância real) do topo de cada Jogador que jogou. `quantidadeCartas` de cada Jogador afetado é atualizada. `rodadaAtual.jogadorDaVez` vira o vencedor; `atributoSelecionado`/`cartasEmDisputa` são limpos. `estado` volta pra `"AguardandoSelecao"`.
- Com empate (dois ou mais Jogadores no valor vencedor): `estado` vira `"Funil"` e nada mais acontece — sem mover Carta, sem trocar `jogadorDaVez`, sem revogar a visibilidade já concedida. Resolver o Funil de verdade é da Story 2.5; esta história só evita ficar presa em `Revelando`.
- `StateView` ao resolver sem empate: revoga (`client.view.remove()`, pra todo Client) a visibilidade de todas as Cartas que foram reveladas nessa Rodada; concede de novo (`client.view.add()`, só pro dono, mesmo padrão do `iniciarPartida`) o **novo** topo do Monte de cada Jogador ativo que ainda tiver Carta — sem isso, ninguém mais veria a própria Carta a partir da segunda Rodada.
- `EstadoPartida` ganha `ultimoResultado: ResultadoRodada` (`vencedorNome: string`, `atributo: string`) — preenchido ao resolver sem empate, público (sem `@view()`, informação que todo mundo já viu na revelação). Frontend usa isso pro Chip de Resultado (UX-DR7): texto sempre presente (ex: "{nome} venceu a rodada com {rótulo do Atributo}"), nunca só cor.
- Frontend: `atributoDestacado` (já encanado desde a Story 2.2) ganha estilo visual de verdade em `Carta.css` — destaca a Linha do Atributo selecionado durante `Revelando`, em todas as Cartas visíveis (própria e reveladas).
- Teto de desempenho (NFR-1, 1,5s de *processamento*) não conflita com a pausa de 2,5s: a pausa é UX deliberada, não tempo de processamento — a comparação em si roda em microssegundos dentro do callback do timer.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução — a pausa de revelação já foi decidida (2,5s) e o comportamento de empate já está definido (estaciona em `Funil`).

**Never:**
- Resolver o Funil de verdade (mover Cartas presas, próximo Atributo do mesmo Jogador, coleta ao sair do empate) — Story 2.5. Esta história só transiciona `estado` pra `"Funil"` e para por aí.
- Exceção do Super Trunfo — Story 2.4. Um Jogador com a Carta Super Trunfo no topo participa da comparação normal desta história (nada de vitória automática ainda).
- Eliminação (Monte chegando a zero) e fim de jogo (32 Cartas reunidas) — Story 2.6. Um Jogador que fica sem Carta depois de perder simplesmente não tem `monte[0]` na próxima Rodada; nenhuma lógica de tirá-lo da rotação de turno é implementada aqui.
- Animação de "Cartas voando pro Monte do vencedor" como requisito funcional — é um nice-to-have visual (CSS), não obrigatório pra esta história. O requisito funcional é a troca de estado + Chip de Resultado com texto.
- Mudar o handler `jogarCarta` em si (validação/aceite da seleção) — só o que vem depois dele (o `setTimeout` agendado ao final).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vencedor único | 2 Jogadores revelados, valores diferentes no Atributo | Vencedor leva as 2 Cartas pro fundo do próprio Monte, vira Jogador da vez, `estado` volta pra `AguardandoSelecao` | N/A |
| Atributo inverso | Atributo selecionado é Aceleração, valores diferentes | Vence quem tem o MENOR valor (AD-7) | N/A |
| Empate | 2+ Jogadores com o mesmo valor vencedor | `estado` vira `Funil`, nada mais muda | N/A (comportamento final é Story 2.5) |
| Visibilidade após resolução | Rodada resolvida sem empate | Cada Jogador ativo com Carta vê só a PRÓPRIA Carta nova; ninguém continua vendo Cartas da Rodada anterior | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/game/comparacao.ts` (novo) -- `determinarVencedor(candidatos, atributo, inverso)`, pura
- `backend/src/schema/ResultadoRodada.ts` (novo) -- Schema: `vencedorNome`, `atributo`
- `backend/src/schema/EstadoPartida.ts` -- adicionar `ultimoResultado: ResultadoRodada`
- `backend/src/rooms/PartidaRoom.ts` -- `aoReceberJogarCarta` agenda `this.clock.setTimeout(() => this.resolverRodada(), DURACAO_REVELACAO_MS)` ao final; novo método privado `resolverRodada()` com toda a lógica de comparação/coleta/StateView/transição
- `frontend/src/components/Carta.css` -- estilo visual de `[data-destacado="true"]`
- `frontend/src/screens/MesaDeJogo.tsx` -- passa `atributoDestacado={rodadaAtual.atributoSelecionado}` durante `Revelando`; renderiza o Chip de Resultado a partir de `estado.ultimoResultado`

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/game/comparacao.ts` -- `determinarVencedor` pura, cobre maior/menor(inverso)/empate
- [x] `backend/src/schema/ResultadoRodada.ts` + `EstadoPartida.ts` -- `ultimoResultado`
- [x] `backend/src/rooms/PartidaRoom.ts` -- timer agendado + `resolverRodada()` completo (comparação, coleta, StateView revoga/concede, transição, `ultimoResultado`) -- efetiva toda a Matrix
- [x] `frontend/src/components/Carta.css` -- destaque visual do Atributo selecionado
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- `atributoDestacado` passado durante `Revelando`; Chip de Resultado
- [x] Testes unitários (`comparacao.test.ts`) -- maior vence, Atributo inverso vence o menor, empate detectado (2 e mais Jogadores)
- [x] Teste de integração de Room -- fluxo completo `jogarCarta` → (espera do timer, usar controle de tempo do Colyseus/Vitest fake timers se disponível, ou aguardar a duração real) → vencedor com as Cartas certas, `jogadorDaVez` atualizado, `estado` de volta a `AguardandoSelecao`; caso de empate parando em `Funil`; visibilidade revogada/concedida verificada via estado decodificado de cliente real (mesmo padrão anti-cheat das Stories 2.1/2.2)
- [x] Teste de componente cobrindo o destaque visual e o Chip de Resultado

**Acceptance Criteria:**
- Given os valores do Atributo foram revelados, when o sistema compara os valores, then vence o maior valor — exceto Aceleração 0-100 km/h, onde vence o menor
- Given um vencedor foi determinado, when a Rodada resolve, then ele coleta todas as Cartas jogadas na Rodada, inseridas no fundo do próprio Monte, e escolhe o Atributo da próxima Rodada
- Given a Rodada resolveu, when qualquer Jogador olha a tela, then o resultado aparece via Chip de Resultado com texto (nunca só cor)

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `PartidaRoom.ts` -- `resolverRodada` agora acha o vencedor ANTES de mover qualquer Carta; se ele desconectou durante `Revelando`, aborta sem mudar estado nem perder Carta (loga aviso), em vez de tentar empurrar Cartas coletadas em lugar nenhum e deixar `jogadorDaVez` travado numa sessão inexistente.
2. `comparacao.ts` -- `determinarVencedor` lança erro claro se `candidatos` vier vazio, em vez de `Math.max(...[])`/`Math.min(...[])` virarem `±Infinity` e explodirem mais adiante com `TypeError`.
3. `PartidaRoom.integration.test.ts` -- novo teste: o vencedor desconecta durante os 2,5s de `Revelando`; confirma que nada crasha, nenhuma Carta some, e o jogo não trava numa transição inválida.
4. `PartidaRoom.integration.test.ts` -- novo teste com 4 Jogadores reais (não só 2) passando pelo pipeline completo de `StateView`/coleta.
5. `MesaDeJogo.tsx` -- Chip de Resultado agora fica escondido quando `estado === "Funil"` -- antes, um empate deixava o Chip da Rodada anterior na tela, sugerindo (errado) que a Rodada atual já tinha vencedor.
6. `PartidaRoom.integration.test.ts` -- teste de "vencedor único" estendido pra uma SEGUNDA Rodada completa, verificando visibilidade via estado decodificado de cliente real. **Isso encontrou um bug real e mais sério do que o esperado**: `ArraySchema.shift()`/`.splice()` do `@colyseus/schema` (^4.0.30) não atualizam o `parentIndex` interno das Cartas que sobram no array -- ao conceder `StateView` de novo pra uma Carta na 2ª Rodada, o cliente recebia um objeto vazio em vez dos dados reais. Corrigido reatribuindo `jogador.monte` a uma instância NOVA de `ArraySchema` ao coletar (em vez de mutar a mesma instância), forçando cada Carta remanescente a se reanexar do zero com o índice correto.
7. `PartidaRoom.integration.test.ts` -- teste de "vencedor único" agora confere os `id`s específicos das Cartas coletadas no fundo do Monte do vencedor, não só a contagem agregada.
8. `e2e/mesa-de-jogo.spec.ts` -- comentário explicando por que o teste aceita uma probabilidade residual (~0,6%) de empate em vez de forçar determinismo (o servidor do E2E é um processo real separado, sem como mockar `embaralhar` como os testes de integração fazem).

## Design Notes

Por que a pausa de 2,5s é necessária tecnicamente, não só por estética: se comparação/coleta rodassem na mesma execução síncrona que concede a revelação (mesmo handler, mesmo tick), o Colyseus nunca chegaria a emitir um patch de rede intermediário mostrando `Revelando` — concessão e revogação de `StateView` dentro do mesmo tick se cancelam antes de qualquer coisa ser transmitida. Sem uma pausa cruzando pelo menos um ciclo de rede, o cliente nunca veria a revelação de verdade.

`rodadaAtual.cartasEmDisputa` continua existindo (schema do AD-5) mas não é a fonte de verdade pra `resolverRodada` -- é só um retrato, populado pela Story 2.2 a partir da mesma ordem de `jogadores`, mas que quebra se algum Jogador ficar sem `monte[0]` no meio do caminho (Jogador que já foi coletado/perdeu Cartas antes -- ainda não acontece nesta história, mas evitar a dependência agora poupa retrabalho quando a Story 2.6 trouxer eliminação).

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui os novos testes de `comparacao.ts`, tudo verde -- **verificado (pós-patch), 37/37 passando**
- `cd backend && npm run test:integration` -- expected: inclui o novo fluxo completo de resolução (vencedor, empate, visibilidade), tudo verde -- **verificado (pós-patch), 27/27 passando**, incluindo os testes que expuseram e confirmaram a correção do bug de `parentIndex`
- `cd frontend && npm test` -- expected: inclui os novos testes de destaque/Chip de Resultado, tudo verde -- **verificado (pós-patch), 58/58 passando**
- `npx playwright test` (raiz) -- expected: verde -- **verificado (pós-patch), 9/9 passando**

**Manual checks (if no CLI):**
- Jogar uma Rodada completa entre 2 jogadores humanos -- confirmar que depois de ~2,5s o resultado aparece, o vencedor ganha as 2 Cartas, e a próxima Rodada começa com o vencedor escolhendo.

## Suggested Review Order

**O bug real que a revisão encontrou (o mais importante desta história)**

- Por que `shift()`/`splice()` na mesma instância de `ArraySchema` corrompe a visibilidade na 2ª Rodada, e por que reatribuir a uma instância nova resolve.
  [`PartidaRoom.ts:446`](../../backend/src/rooms/PartidaRoom.ts#L446)

- Teste que expôs o bug (2ª Rodada completa, verificado contra estado decodificado de cliente real).
  [`PartidaRoom.integration.test.ts:639`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L639)

**`resolverRodada`: comparação, coleta, StateView, próxima Rodada**

- Achar o vencedor antes de mexer em qualquer Carta -- inclui a blindagem contra desconexão durante `Revelando`.
  [`PartidaRoom.ts:396`](../../backend/src/rooms/PartidaRoom.ts#L396)

- `determinarVencedor` -- pura, maior vence exceto Atributo inverso, empate sinalizado (nunca crasha com lista vazia).
  [`comparacao.ts:34`](../../backend/src/game/comparacao.ts#L34)

**Frontend: destaque e Chip de Resultado**

- Chip de Resultado escondido durante `Funil` -- evita mostrar o resultado da Rodada anterior como se fosse da atual.
  [`MesaDeJogo.tsx`](../../frontend/src/screens/MesaDeJogo.tsx)

**Testes de ponta a ponta**

- Fluxo real: pausa de revelação, resultado aparece nos dois navegadores.
  [`mesa-de-jogo.spec.ts:216`](../../e2e/mesa-de-jogo.spec.ts#L216)
