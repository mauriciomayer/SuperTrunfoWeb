---
title: 'Chip de Resultado Aparece Junto com a Revelação (Story 7.3)'
type: 'feature'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'e646e669a47be1fe96988beacd13fda2611e7a32'
---

<frozen-after-approval reason="intenção de propriedade humana — não modificar a menos que o humano renegocie">

## Intenção

**Problema:** Hoje o vencedor da Rodada só é calculado DEPOIS da pausa de revelação de 2.5s (`DURACAO_REVELACAO_MS`) — `resolverRodada` (que faz TUDO: calcular vencedor, mover Cartas, trocar a vez, Funil/Fim de Partida) só roda dentro do `this.clock.setTimeout` agendado ao final de `processarJogada`. As Cartas já aparecem reveladas na tela, mas ninguém sabe quem ganhou até a pausa acabar e a Rodada seguinte já estar começando.

**Abordagem:** Separar o CÁLCULO do vencedor (novo método `calcularResultadoImediato`, chamado SINCRONAMENTE dentro de `processarJogada`, preenchendo `ultimoResultado` no mesmo instante que `estado` vira `"Revelando"`/`"SuperTrunfoAcionado"`) da APLICAÇÃO das consequências (mover Cartas, trocar a vez, Funil/Fim de Partida — continua 100% inalterada dentro de `resolverRodada`, agendada exatamente como hoje). Os dados para calcular (Carta do topo de cada Jogador ativo) já estão completos nesse instante síncrono — a revelação é simultânea, ninguém espera ninguém.

## Limites e Restrições

**Sempre:**
- `calcularResultadoImediato` é um método NOVO e SEPARADO de `resolverRodada` — nunca uma extração de lógica compartilhada entre os dois. `resolverRodada` fica 100% BYTE-A-BYTE inalterado (nenhuma linha tocada), incluindo suas próprias atribuições (agora redundantes, mas inofensivas) de `ultimoResultado`.
- `calcularResultadoImediato` NUNCA move Cartas, troca `jogadorDaVez`, mexe no Funil, nem decide Fim de Partida — só preenche `ultimoResultado` (`vencedorNome`/`atributo`/`tipoVitoria`) ou o limpa (empate). Tudo isso continua em `resolverRodada`, depois da pausa, exatamente como hoje.
- `calcularResultadoImediato` NÃO precisa replicar os guards defensivos de `resolverRodada` contra um Jogador ter desconectado durante a pausa (linhas ~663-681, ~906-914 do arquivo atual) — esses guards existem pra um cenário estruturalmente inalcançável (Story 3.2, `onLeave` numa Partida em andamento nunca mais remove um Jogador), mas ainda assim só fazem sentido DEPOIS da pausa. Chamado ANTES da pausa começar, o remetente e todo `jogadoresAtivos` estão garantidamente presentes em `state.jogadores` nesse instante síncrono — os guards nunca poderiam disparar aqui.
- O Chip de Resultado (`MesaDeJogo.tsx`) passa a exigir `estado` ser `"Revelando"` OU `"SuperTrunfoAcionado"` — reusando as variáveis `revelando`/`superTrunfoAcionado` já existentes no componente (calculadas pra outros fins, Story 2.3/2.4) — além do guard já existente de `ultimoResultado.vencedorNome` truthy. O mecanismo de timer/rastreamento de transição da História 6.3 (`mostrarChipResultado`, `estadoAnteriorRef`, `timerEsconderChipRef`, `DURACAO_CHIP_VISIVEL_MS`) é REMOVIDO por inteiro — deixou de ser necessário.
- Durante a revelação de uma Rodada de desempate (retry após um empate no Funil), o Chip (mostrando o NOVO vencedor) e a tray do Funil (ainda mostrando a contagem ANTIGA, não esvaziada até `resolverRodada` aplicar as consequências) podem ficar visíveis AO MESMO TEMPO — comportamento novo, intencional e correto (mostra "quem está prestes a ganhar" + "o que ainda será coletado"), não um bug.
- Testes existentes que montam `MesaDeJogo` com `estado: "AguardandoSelecao"` (ou omitem `estado`, mesmo default) esperando o Chip visível precisam mudar pra `estado: "Revelando"`/`"SuperTrunfoAcionado"` — esse é o comportamento correto novo, não uma regressão a evitar.

**Perguntar Antes:** nenhuma decisão identificada até agora que exija aprovação humana antes de prosseguir.

**Nunca:**
- Nunca extrair um helper compartilhado entre `calcularResultadoImediato` e `resolverRodada` — os dois têm necessidades de guard genuinamente diferentes (ver "Sempre" acima); forçar um contrato único criaria uma abstração incorreta.
- Nunca alterar `DURACAO_REVELACAO_MS` nem o agendamento de `resolverRodada` via `this.clock.setTimeout` — a pausa em si continua exatamente como hoje.
- Nunca remover os testes de integração de backend já existentes que verificam `resolverRodada` (Stories 2.3-2.6, 3.1-3.2) — todos devem continuar passando sem alteração.

## Matriz de Entrada/Saída e Casos-Limite

| Cenário | Entrada / Estado | Saída/Comportamento Esperado | Tratamento de Erro |
|----------|--------------|---------------------------|----------------|
| Vitória normal (Atributo) | Jogador seleciona Atributo, Cartas revelam | `ultimoResultado` (vencedor/atributo/tipoVitoria="atributo") preenchido IMEDIATAMENTE, antes da pausa acabar | N/A |
| Super Trunfo sem oposição | Carta Super Trunfo jogada | `ultimoResultado` (tipoVitoria="superTrunfo") preenchido imediatamente | N/A |
| Super Trunfo anulado por Carta "A" | Super Trunfo jogado, oponente tem Carta "A" | `ultimoResultado` (tipoVitoria="cartaA") preenchido imediatamente | N/A |
| Empate | 2+ Jogadores empatam no Atributo | `ultimoResultado.vencedorNome` fica vazio imediatamente (Chip nunca aparece) | N/A |
| Fora de Revelando/SuperTrunfoAcionado | `estado === "AguardandoSelecao"`, `ultimoResultado` com valor de Rodada anterior | Chip NUNCA aparece, independente do valor de `ultimoResultado` | N/A |
| Retry de desempate revelando | `estado === "Revelando"` (retry pós-empate), Funil ainda com cartas presas | Chip (novo vencedor) E tray do Funil (contagem antiga) visíveis ao mesmo tempo | N/A |

</frozen-after-approval>

## Mapa de Código

- `backend/src/rooms/PartidaRoom.ts` -- novo método privado `calcularResultadoImediato(jogadoresAtivos: Jogador[])`, chamado de `processarJogada` logo após `this.state.estado = ehSuperTrunfo ? "SuperTrunfoAcionado" : "Revelando"` (linha ~518) e ANTES de `this.clock.setTimeout(() => this.resolverRodada(), DURACAO_REVELACAO_MS)` (linha ~526). `jogadoresAtivos` já está computado em `processarJogada` (linha ~469, mesmo dado que popula `cartasEmDisputa`) -- passar direto, sem recomputar.
- `backend/src/rooms/PartidaRoom.ts`, `calcularResultadoImediato` -- espelha a lógica de determinação de vencedor de `resolverRodada` (linhas ~659-693 pro branch Super Trunfo via `determinarVencedorSuperTrunfo`, ~694-706 pro branch Atributo via `determinarVencedor`, mesmos imports já existentes `ATRIBUTOS`/`CandidatoComparacao`/`CandidatoSuperTrunfo`), MAS sem os guards de "não encontrado" (ver Boundaries "Sempre" pro porquê) -- só preenche `this.state.ultimoResultado.vencedorNome`/`atributo`/`tipoVitoria` (vitória) ou limpa `vencedorNome`/`atributo` (empate). `resolverRodada` (linha ~649) permanece INTOCADO.
- `frontend/src/screens/MesaDeJogo.tsx` -- remover `DURACAO_CHIP_VISIVEL_MS` (linha 17), os 3 hooks `mostrarChipResultado`/`estadoAnteriorRef`/`timerEsconderChipRef` (linhas 219-221) e o `useEffect` inteiro que os gerencia (linhas 223-279, incluindo os comentários). `revelando` (linha 295) e `superTrunfoAcionado` (linha 304) já existem, calculados pra outros fins (destaque de Atributo/Carta "A") -- reusar diretamente.
- `frontend/src/screens/MesaDeJogo.tsx`, render do Chip (linha ~436) -- trocar `{ultimoResultado && ultimoResultado.vencedorNome && mostrarChipResultado && (` por `{ultimoResultado && ultimoResultado.vencedorNome && (revelando || superTrunfoAcionado) && (`.
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- novos testes: (a) logo após `jogarCarta` (mesmo padrão `await vi.waitFor(() => expect(room.state.estado).toBe("Revelando"/"SuperTrunfoAcionado"))` já usado em toda a suite, ex.: linha ~960), `ultimoResultado` JÁ está preenchido corretamente (vencedor/atributo/tipoVitoria), ANTES de esperar a pausa acabar; (b) mesma prova pro caso de empate (`vencedorNome` vazio imediatamente); (c) confirma que o restante da suite (testes de `resolverRodada` já existentes, Stories 2.3-2.6/3.1-3.2) continua passando SEM NENHUMA alteração -- prova que `resolverRodada` de fato não foi tocado.
- `frontend/src/screens/MesaDeJogo.test.tsx` -- **substituir por inteiro** o describe block `"MesaDeJogo -- Chip de Resultado some sozinho (Story 6.3)"` (linhas 413-648, ~235 linhas, todo baseado no timer removido) por um novo describe menor testando o guard direto de `estado` (sem fake timers): Chip visível imediatamente com `estado: "Revelando"`; visível com `estado: "SuperTrunfoAcionado"`; NUNCA visível com `estado: "AguardandoSelecao"` mesmo com `ultimoResultado.vencedorNome` truthy/velho (o teste de regressão mais importante desta história); reaparece numa 2a Rodada com o MESMO vencedor+atributo (trivial agora, mas vale manter); empate sanduichado entre 2 Rodadas (Funil).
- `frontend/src/screens/MesaDeJogo.test.tsx` -- **atualizar `estado` pra `"Revelando"`** (ou `"SuperTrunfoAcionado"` conforme o caso) nos testes existentes que hoje montam com `"AguardandoSelecao"`/default e esperam o Chip visível: describe "Story 2.3" (linhas 346-373, 2 testes), describe "Super Trunfo (Story 2.4)" (linhas 757-817, 3 testes -- "atributo" usa `"Revelando"`, "superTrunfo"/"cartaA" usam `"SuperTrunfoAcionado"`).
- `frontend/src/screens/MesaDeJogo.test.tsx`, describe "Funil (Story 2.5)" -- o teste "o Chip de Resultado reaparece assim que o Funil esvazia" (linha 730-744) **precisa ser reescrito**, não só ter o `estado` trocado: o cenário real agora é `estado: "Revelando"` (retry revelando) com `ultimoResultado` já mostrando o vencedor E `funil.quantidadeCartasPresas` AINDA não-zero (as consequências, incluindo esvaziar o Funil, só aplicam depois da pausa) -- o teste deve afirmar que o Chip E a tray do Funil aparecem SIMULTANEAMENTE nesse instante (ver Boundaries "Sempre").
- `docs/deferred-work.md` (achado de blind-hunter da revisão de código, Story 5.1, `deferred-work.md`) -- fechar/anotar como RESOLVIDO: com o Chip amarrado a `estado` em vez de só a `ultimoResultado.vencedorNome`, o valor "velho" de `ultimoResultado` fora da revelação deixa de importar (ninguém olha pra ele fora de Revelando/SuperTrunfoAcionado).

## Tarefas e Critérios de Aceite

**Execução:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- adicionar `calcularResultadoImediato`, chamá-lo de `processarJogada` antes do `this.clock.setTimeout`.
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- testes novos (a)/(b)/(c) do Mapa de Código.
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- remover o mecanismo da História 6.3, simplificar o guard de render do Chip.
- [x] `frontend/src/screens/MesaDeJogo.test.tsx` -- substituir o describe block da História 6.3; atualizar os 5 testes existentes listados no Mapa de Código (2.3 x2, Super Trunfo x3); reescrever o teste do Funil.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- marcar a entrada da Story 5.1 sobre `ultimoResultado` como resolvida por esta história.

**Critérios de Aceite:**
- Dado um Jogador seleciona um Atributo (ou joga a Carta Super Trunfo), quando as Cartas do topo de todos os Jogadores são reveladas simultaneamente, então o sistema já calcula o vencedor da Rodada e o Chip de Resultado aparece nesse mesmo instante, sem esperar o fim da pausa de revelação (FR-38).
- Dado o mesmo cenário, quando a pausa termina, então as consequências da Rodada (mover Cartas, trocar `jogadorDaVez`, Funil/eliminação/fim de Partida) continuam sendo aplicadas exatamente como hoje -- provado pela suite de `resolverRodada` já existente continuando a passar sem alteração.
- Dado o `estado` está fora de `Revelando`/`SuperTrunfoAcionado`, quando a Rodada não está em revelação, então o Chip de Resultado nunca aparece, independente do valor de `ultimoResultado`.

## Histórico de Mudanças do Spec

- **Revisão (verification-gap):** o Boundary "Nunca" que exigia os testes de `resolverRodada` já existentes continuarem passando "sem alteração" não se sustentou literalmente: o teste de Story 3.2 "desconexao durante a pausa de SuperTrunfoAcionado" (`PartidaRoom.integration.test.ts`) precisou ter suas asserções sobre `ultimoResultado`/`quantidadeCartas` da Rodada 1 movidas pra ANTES da Rodada 2 começar a revelar -- do contrário, `calcularResultadoImediato` já teria sobrescrito `ultimoResultado` com o resultado da Rodada 2 (jogada automaticamente pela IA) no momento em que o teste checava. É uma interação entre Rodadas que o spec não antecipou: qualquer teste que insira uma pausa entre o fim de uma Rodada e a checagem de `ultimoResultado` dela, com uma Rodada seguinte automática (IA) no meio, precisa da mesma reordenação. `resolverRodada` em si permanece 100% intocado -- só a ORDEM das asserções do teste mudou, nenhuma asserção foi removida ou enfraquecida (confirmado: 57/57 testes de integração passam).
- **Revisão (verification-gap):** comando `Verificação` corrigido -- faltava `--config vitest.integration.config.ts` (a suite de integração é excluída da config padrão do Vitest neste projeto).

## Notas de Design

Por que "calcular duas vezes" (uma em `calcularResultadoImediato`, outra dentro de `resolverRodada`) em vez de extrair um helper compartilhado: os dois pontos têm necessidades de guard genuinamente diferentes, não é duplicação por preguiça. `resolverRodada` roda DEPOIS da pausa de 2.5s e precisa se defender contra um Jogador ter desconectado NESSE meio-tempo (guards hoje estruturalmente inalcançáveis desde a Story 3.2, mas preservados de propósito). `calcularResultadoImediato` roda ANTES da pausa começar, no mesmo instante síncrono em que os dados de `cartasEmDisputa` acabaram de ser montados -- não existe "meio-tempo" pra alguém desconectar ainda. Forçar os dois num único helper exigiria inventar um contrato artificial pra guards que só um dos dois lados realmente precisa.

As duas funções `determinarVencedor`/`determinarVencedorSuperTrunfo` (`backend/src/game/comparacao.ts`/`superTrunfo.ts`) são puras e determinísticas (comparação numérica / índice circular, sem `Math.random`) -- dado que nada muda `jogador.monte[0]` entre o cálculo imediato e a aplicação (nenhum `jogarCarta` novo é aceito durante `Revelando`/`SuperTrunfoAcionado`, e a conversão pra IA por desconexão da Story 3.2 nunca mexe em `monte`), as duas chamadas SEMPRE concordam no mesmo vencedor.

## Verificação

**Comandos:**
- `cd backend && npx vitest run --config vitest.integration.config.ts PartidaRoom.integration` (equivalente a `npm run test:integration`) -- esperado: todos os testes passam, incluindo os novos, sem nenhuma regressão nos testes de `resolverRodada` já existentes (Stories 2.3-2.6, 3.1-3.2).
- `cd frontend && npx vitest run MesaDeJogo` -- esperado: todos os testes passam, incluindo o describe block novo, sem o describe da História 6.3.

## Ordem Sugerida de Revisão

**Mecanismo central: calcularResultadoImediato (o "porquê")**

- Chamada nova, logo após `estado` virar `Revelando`/`SuperTrunfoAcionado`, ANTES do `this.clock.setTimeout` que agenda `resolverRodada`.
  [`PartidaRoom.ts:524-525`](../../backend/src/rooms/PartidaRoom.ts#L524-L525)

- `resolverRodada` continua agendado exatamente como antes -- prova de que a pausa em si não mudou.
  [`PartidaRoom.ts:533`](../../backend/src/rooms/PartidaRoom.ts#L533)

- O método em si: calcula e preenche (ou limpa, no empate) `ultimoResultado` -- nunca move Carta, troca `jogadorDaVez`, nem mexe no Funil.
  [`PartidaRoom.ts:547-644`](../../backend/src/rooms/PartidaRoom.ts#L547-L644) (doc do método), [`PartidaRoom.ts:581`](../../backend/src/rooms/PartidaRoom.ts#L581) (assinatura)

**Testes de backend (a prova de que os dois cálculos concordam)**

- Describe novo -- 4 casos (Atributo, Super Trunfo sem oposição, Super Trunfo anulado por Carta "A", empate), cada um provando que `ultimoResultado` já está correto ANTES da pausa acabar.
  [`PartidaRoom.integration.test.ts:3529`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L3529)

- Ajuste num teste já existente (Story 3.2): asserções sobre a Rodada 1 movidas pra antes da Rodada 2 (automática, via IA) começar a revelar -- ver Histórico de Mudanças do Spec acima pro porquê.
  [`PartidaRoom.integration.test.ts:3341-3354`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L3341-L3354)

**Frontend: o novo guard do Chip (substitui a História 6.3 por inteiro)**

- Guard direto -- `estado` precisa ser `Revelando`/`SuperTrunfoAcionado`, sem timer nem `useRef`.
  [`MesaDeJogo.tsx:359`](../../frontend/src/screens/MesaDeJogo.tsx#L359)

- Describe novo de componente -- cobre visibilidade imediata, ausência fora das duas Estados (teste de regressão mais importante desta história), e reaparição com o mesmo vencedor/atributo.
  [`MesaDeJogo.test.tsx:417`](../../frontend/src/screens/MesaDeJogo.test.tsx#L417)

- Teste do Funil reescrito -- prova que Chip+Funil podem ficar visíveis ao mesmo tempo durante o retry de desempate (intencional, não um bug).
  [`MesaDeJogo.test.tsx:648`](../../frontend/src/screens/MesaDeJogo.test.tsx#L648)

**Acompanhamento**

- `deferred-work.md` -- entrada da Story 5.1 marcada como resolvida por esta história; 2 novas entradas de baixa severidade da revisão (cobertura de teste do caso 4-Jogadores/múltiplas Carta "A", e `tipoVitoria` obsoleto pré-existente em empates).
  [`deferred-work.md`](../implementation-artifacts/deferred-work.md)
