---
title: 'Precisão Numérica dos Atributos'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '54d93446b1ac90261265047219b44750a8556f2c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Aceleração 0-100 km/h" é o único Atributo com casas decimais no CSV (sempre 1 casa, ex: `3.2`); no frontend ele aparece com artefato de ponto flutuante (ex: `3.200000047683716`) em vez do valor exato.

**Approach:** Causa raiz confirmada lendo o encoder real do Colyseus (`@colyseus/schema`, `number$1` em `build/index.mjs`): o tipo genérico `"number"` decide dinamicamente entre float32 (4 bytes) e float64 (9 bytes) por um teste de tolerância de precisão (`1e-4`) -- `3.2` passa nesse teste e é codificado como float32, que não representa `3.2` exatamente (`3.2` como float32, lido de volta como float64, é literalmente `3.200000047683716`). Trocar `@type("number")` por `@type("float64")` no campo `aceleracao` força sempre o caminho de 9 bytes (`float64$1`), que nunca passa pelo teste de tolerância -- fix de uma linha no schema.

## Boundaries & Constraints

**Always:**
- `backend/src/schema/Carta.ts`: campo `aceleracao` muda de `@type("number")` pra `@type("float64")`. Nenhum outro campo muda -- os outros 6 Atributos são inteiros, não sofrem desse problema.
- O valor exibido no frontend precisa bater exatamente com o valor do CSV (ex: `3.2` no CSV → `"3.2 s"` na tela, nunca `"3.200000047683716 s"`).

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- causa raiz e correção já confirmadas lendo o código-fonte real do encoder.

**Never:**
- Nenhuma mudança em `docs/carros_specs.csv`, `backend/src/game/baralho.ts` (já faz `Number(registro[...])` corretamente -- o valor em memória no servidor sempre foi exato; o bug é só na serialização de rede) nem em `frontend/src/components/Carta.tsx` (renderiza `${carta.aceleracao} s` direto, sem arredondamento -- já correto, só precisa que o valor que chega esteja certo).
- Nenhuma mudança nos outros 6 Atributos nem em `atributos.ts`/`comparacao.ts` (lógica de comparação não muda, só a precisão de transporte do valor).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valor fracionário trafega pela rede | Uma Carta com `aceleracao` fracionário (ex: `3.2`) é sincronizada do servidor pro cliente via Colyseus | O cliente decodifica exatamente `3.2`, sem artefato de ponto flutuante | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/schema/Carta.ts:37` -- `@type("number") aceleracao: number = 0;` → `@type("float64") aceleracao: number = 0;` (comentário existente sobre `inverso`/Story 2.2 permanece).
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- nenhum teste hoje verifica o valor de `aceleracao` do lado do CLIENTE (decodificado via rede real) -- todo teste existente que usa `aceleracao` é unitário (`comparacao.test.ts`) ou de schema/servidor puro (`baralho.test.ts`, `PartidaRoom.test.ts`), nunca passando pelo encoder/decoder de verdade. Precisa de um teste novo que crie uma Partida real, force uma Carta com `aceleracao` fracionário pro topo de um Jogador, e confirme no `room.state` do CLIENTE (não do servidor) que o valor decodificado bate exatamente com o do CSV -- é o único jeito de provar que o bug de serialização está fechado (reproduzido e confirmado via leitura direta do encoder-fonte do Colyseus antes desta spec).

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/schema/Carta.ts` -- trocar `@type("number")` por `@type("float64")` no campo `aceleracao`
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- novo teste de integração forçando uma Carta com `aceleracao` fracionário (Carta `1A`, `3.2` do CSV real) pro topo de um Jogador, confirmando que o estado decodificado do CLIENTE bate exatamente com `3.2`, nunca aproximado
- [x] (achado da revisão, corroborado por 2 revisores independentes) O teste usava `setTimeout(150ms)` fixo pra esperar a propagação do `StateView` pro cliente, em vez do padrão `vi.waitFor` já usado no resto do arquivo -- risco de falso-negativo intermitente sob carga do CI. Substituído por `vi.waitFor` com predicado na condição real (`aceleracao` decodificado e definido)

**Acceptance Criteria:**
- Given uma Carta com valor fracionário no Atributo Aceleração 0-100 km/h (ex: `3.2`), when o valor é transmitido do servidor pro cliente e exibido, then o valor mostrado tem exatamente a mesma precisão decimal do `docs/carros_specs.csv` -- nunca artefato de ponto flutuante (ex: `3.200000047683716`) (FR-30)

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 67/67 verde (8 arquivos)
- `cd backend && npm run test:integration` -- o teste novo de precisão passou em 100% das execuções (isoladas e dentro da suíte completa). A suíte completa mostrou falhas intermitentes de `MatchMakeError: fetch failed` em `testServer.connectTo` -- mesmo padrão de flakiness ambiental documentado ao longo de todo o projeto, nunca no teste desta história, sempre em testes pré-existentes não relacionados, confirmado transiente via reexecução isolada de cada um (inclusive uma vez no próprio teste desta história, também confirmado limpo isoladamente)
- Sanity check da revisão: schema revertido temporariamente pra `@type("number")`, teste novo executado -- falhou com `expected 3.200000047683716 to be 3.2` (o artefato exato descrito no Problem), confirmando que o teste realmente detecta a regressão. Restaurado e reconferido limpo
- `npx tsc -b` (backend) -- limpo

**Manual checks (if no CLI):**
- Abrir uma Partida real, comparar Aceleração numa Rodada, e confirmar visualmente que o valor exibido tem exatamente 1 casa decimal (ex: "3.2 s"), nunca várias casas.

## Suggested Review Order

- Ponto de entrada: o fix de uma linha -- `@type("float64")` força o encoder de 9 bytes do Colyseus, nunca o caminho de float32 que causava o artefato.
  [`Carta.ts:37`](../../backend/src/schema/Carta.ts#L37)

- Prova via rede real: o teste de integração que decodifica `aceleracao` do lado do CLIENTE (não do servidor), o único jeito de provar que o bug de serialização está fechado.
  [`PartidaRoom.integration.test.ts:2963`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2963)

- (achado da revisão) `vi.waitFor` com predicado na condição real, em vez do `setTimeout` fixo original.
  [`PartidaRoom.integration.test.ts:3017`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L3017)
