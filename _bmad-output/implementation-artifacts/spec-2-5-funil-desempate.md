---
title: 'Funil (Desempate)'
type: 'feature'
created: '2026-08-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
baseline_commit: 'f89947ed7277d78825aaa1f5bbe37a1240c08167'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `resolverRodada` (Story 2.3) já detecta empate (`determinarVencedor` retorna `{ empate: true }`), mas só seta `estado = "Funil"` e retorna -- nenhuma Carta é movida, ninguém pode jogar de novo (`jogarCarta` só aceita `estado === "AguardandoSelecao"`), a Partida trava.

**Approach:** Ao empatar, as Cartas da Rodada saem do topo de cada Jogador que jogou e vão pro Funil (`EstadoPartida.funil`, novo); `jogadorDaVez` NÃO muda (quem abriu a Rodada empatada escolhe de novo, com a Carta que sobrou no topo); `estado` volta direto pra `"AguardandoSelecao"` (mesma Rodada lógica, nova seleção). Quando uma Rodada finalmente resolve SEM empate (Story 2.3/2.4, inalterado), o vencedor recebe as Cartas da Rodada normalmente MAIS tudo que estava retido no Funil, que então esvazia.

## Boundaries & Constraints

**Always:**
- `backend/src/schema/Funil.ts` (novo): `@view() @type([Carta]) cartasPresas` (nunca concedido a nenhum Client -- mesma postura padrão-segura de `Rodada.cartasEmDisputa`, ninguém precisa ver Carta individual retida) + `@type("number") quantidadeCartasPresas` (público, pro Componente Funil mostrar contagem).
- No branch de empate de `resolverRodada`: revoga `StateView` das Cartas da Rodada (mesmo loop do caminho vencedor); move a Carta do topo de cada `jogadorQueJogou` pro Funil reatribuindo `monte` a uma `ArraySchema` NOVA (nunca `shift()`/`splice()` na mesma instância -- mesmo bug de `parentIndex` da Story 2.3); acumula em `funil.cartasPresas` (também reatribuindo a uma instância nova, mesma cautela); limpa `ultimoResultado` (`vencedorNome = ""`, `atributo = ""`) -- sem isso o Chip de Resultado mostraria a última vitória de verdade como se fosse desta Rodada; concede de novo `StateView` do novo topo de cada Jogador ativo pro próprio dono (mesmo loop pós-vitória); `estado` volta pra `"AguardandoSelecao"`; `rodadaAtual.jogadorDaVez` NÃO muda.
- No branch SEM empate (Story 2.3/2.4, reaproveitado): se `funil.quantidadeCartasPresas > 0`, o vencedor recebe também `funil.cartasPresas` (reatribuindo o Monte dele com o `push`, mesmo padrão já usado pras Cartas da própria Rodada) e o Funil esvazia (nova `ArraySchema`, `quantidadeCartasPresas = 0`).
- Frontend: `frontend/src/components/Funil.tsx` (novo) -- tray "🃏 Cartas presas no Funil (N)" + "Empate! {nome do jogadorDaVez} escolhe um novo atributo com a próxima carta.", visível sempre que `funil.quantidadeCartasPresas > 0`, independente do `estado` atual (persiste durante toda a sequência de desempate, não só logo após o empate).
- `MesaDeJogo.tsx`: remove o gate `estado !== "Funil"` do Chip de Resultado (obsoleto -- `ultimoResultado` agora é limpo no empate, `vencedorNome` vazio já basta) e renderiza `Funil` quando aplicável.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Eliminação e fim de jogo (Story 2.6) -- mesmo que a remoção da Carta empatada zere o Monte de alguém, nenhuma lógica de eliminação roda aqui.
- Qualquer pausa nova antes de `estado` voltar pra `"AguardandoSelecao"` -- a revelação dos valores empatados já aconteceu durante o `"Revelando"` anterior (com sua própria pausa); não há StateView novo que precise de um ciclo de rede pra se tornar visível aqui, então a transição é síncrona (ver Design Notes).
- Mudar `determinarVencedor`/`game/comparacao.ts` -- a detecção de empate já existe e está correta (Story 2.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empate simples | 2+ Jogadores empatam no maior valor do Atributo | Cartas da Rodada vão pro Funil, `jogadorDaVez` não muda, `estado` volta pra `AguardandoSelecao` | N/A |
| Nova Rodada sem empate após Funil | Jogador que abriu o empate joga a próxima Carta, novo Atributo, sem novo empate | Vencedor coleta a nova Carta, as dos oponentes, E tudo que estava no Funil; Funil esvazia | N/A |
| Empates consecutivos | Segunda Rodada de desempate também empata | Funil acumula (Cartas da 1ª + 2ª Rodada empatada juntas), `jogadorDaVez` continua o mesmo | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/schema/Funil.ts` (novo) -- `cartasPresas`/`quantidadeCartasPresas`
- `backend/src/schema/EstadoPartida.ts` -- adicionar `@type(Funil) funil = new Funil()`
- `backend/src/schema/ResultadoRodada.ts` -- nenhum campo novo (só limpar `vencedorNome`/`atributo` em `PartidaRoom.ts`)
- `backend/src/rooms/PartidaRoom.ts` -- `resolverRodada()`: completar o branch de empate (hoje só `estado = "Funil"; return;`, linha ~488-494); branch sem-empate absorve `funil.cartasPresas` antes de finalizar
- `frontend/src/components/Funil.tsx` (novo) -- tray, mirror de `EstadoPartida.funil`
- `frontend/src/screens/MesaDeJogo.tsx` -- renderiza `Funil`; remove gate obsoleto do Chip de Resultado

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/schema/Funil.ts` + `EstadoPartida.ts` -- schema novo
- [x] `backend/src/rooms/PartidaRoom.ts` -- `resolverRodada()` completo (Matrix inteira: empate simples, coleta pós-Funil, acúmulo em empates consecutivos)
- [x] `frontend/src/components/Funil.tsx` + `MesaDeJogo.tsx` -- tray + Chip de Resultado corrigido
- [x] Teste de integração de Room -- Matrix inteira via `@colyseus/testing`, incluindo verificação client-decodificada de que `cartasPresas` nunca vaza StateView pra nenhum Client
- [x] Teste de componente -- `Funil.tsx` (contagem, visibilidade) e `MesaDeJogo.tsx` (Chip some corretamente durante empate, Carta própria volta a ficar clicável na mesma Rodada lógica)

**Acceptance Criteria:**
- Given há empate no maior valor do Atributo selecionado, when o sistema detecta o empate, then todas as Cartas da Rodada vão para o Funil e o Jogador que abriu a Rodada empatada escolhe um novo Atributo com a próxima Carta do topo, sem passar a vez
- Given o Funil tem Cartas retidas, when a nova Rodada de desempate resolve sem empate, then o vencedor coleta a nova Carta, as dos adversários, e tudo que estava no Funil

## Design Notes

`estado` passa por `"Funil"` só como valor intermediário DENTRO da mesma chamada síncrona de `resolverRodada` -- nunca fica visível em rede nesse valor (mesmo motivo por trás do padrão já usado em `"Revelando"`/`"SuperTrunfoAcionado"`, mas ao contrário: aqui NÃO existe StateView novo que dependa de um ciclo de rede pra se tornar visível, então não há motivo pra pausa. O que persiste visualmente é o Componente `Funil` (dirigido por `funil.quantidadeCartasPresas`, não pelo `estado` transitório) -- o mockup (`key-mesa-jogo.html`, coluna "Empate → Funil") já mostra a tray dentro de uma tela normal de `AguardandoSelecao`, não como um overlay de transição separado.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: sem regressão, tudo verde
- `cd backend && npm run test:integration` -- expected: inclui a Matrix inteira do Funil, tudo verde
- `cd frontend && npm test` -- expected: inclui `Funil.tsx` + ajustes de `MesaDeJogo.tsx`, tudo verde
- `npx playwright test` (raiz) -- expected: sem regressão na suite existente; cenário de Funil forçado NÃO estendido (mesmo gap de determinismo já aceito nas Stories 2.3/2.4 -- documentar em `deferred-work.md`)

## Suggested Review Order

**Resolução do empate -- o coração da história**

- Ponto de entrada: onde o empate parava de fazer nada e agora move as Cartas pro Funil, limpa `ultimoResultado`, preserva `jogadorDaVez`.
  [`PartidaRoom.ts:504`](../../backend/src/rooms/PartidaRoom.ts#L504)

- Caminho vencedor absorve o Funil acumulado antes de esvaziá-lo -- reaproveita o mesmo `push` das Cartas da própria Rodada.
  [`PartidaRoom.ts:642`](../../backend/src/rooms/PartidaRoom.ts#L642)

**Schema novo**

- `Funil` -- `cartasPresas` marcada `@view()` (nunca concedida), `quantidadeCartasPresas` pública pro frontend.
  [`Funil.ts:18`](../../backend/src/schema/Funil.ts#L18)

- `EstadoPartida.funil` nested, mesmo padrão de `rodadaAtual`/`ultimoResultado`.
  [`EstadoPartida.ts:92`](../../backend/src/schema/EstadoPartida.ts#L92)

**Frontend -- tray e integração**

- Componente `Funil` -- se auto-esconde em `quantidadeCartasPresas <= 0`, nunca decide a partir de `estado`.
  [`Funil.tsx:30`](../../frontend/src/components/Funil.tsx#L30)

- `MesaDeJogo` calcula a contagem e renderiza a tray, independente do `estado` atual.
  [`MesaDeJogo.tsx:233`](../../frontend/src/screens/MesaDeJogo.tsx#L233)
  [`MesaDeJogo.tsx:274`](../../frontend/src/screens/MesaDeJogo.tsx#L274)

**Testes**

- Matrix inteira via Room real: empate simples, coleta pós-Funil, empates consecutivos, com verificação client-decodificada de que `cartasPresas` nunca vaza.
  [`PartidaRoom.integration.test.ts:1158`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L1158)

- Componente `Funil` isolado -- contagem, visibilidade, fallback sem `nomeJogadorDaVez`.
  [`Funil.test.tsx:16`](../../frontend/src/components/Funil.test.tsx#L16)

- `MesaDeJogo` -- Chip de Resultado some no empate e reaparece quando o Funil esvazia; Carta própria volta a ficar clicável na mesma Rodada lógica.
  [`MesaDeJogo.test.tsx:403`](../../frontend/src/screens/MesaDeJogo.test.tsx#L403)
