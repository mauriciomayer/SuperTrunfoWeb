---
title: 'Trocar a Carta Super Trunfo'
type: 'chore'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '9810d9055489220c192d23dac7f0b6f9e2d10937'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Carta Super Trunfo hoje é a Ferrari 812 Superfast (`2A`); o Mauricio quer que seja o Jaguar F-Type R (`6D`, já presente no Baralho como Carta comum).

**Approach:** Inverter a flag `SuperTrunfo` entre as duas linhas do CSV (`2A`: true→false, `6D`: false→true). Investigação prévia encontrou ~25 referências hardcoded a `"2A"` como "a Carta Super Trunfo" espalhadas em `backend/src/rooms/PartidaRoom.integration.test.ts` (cenários inteiros de teste montados em torno dela) e 1 em `backend/src/game/baralho.test.ts` -- todas precisam virar `"6D"` junto com o dado, ou os testes quebram (não é uma mudança "só de dado" na prática).

## Boundaries & Constraints

**Always:**
- `docs/carros_specs.csv`: linha `2A` (Ferrari 812 Superfast) vira `SuperTrunfo=false`; linha `6D` (Jaguar F-Type R) vira `SuperTrunfo=true`. Nenhuma outra coluna de nenhuma das duas linhas muda.
- Toda referência a `"2A"` em `backend/src/rooms/PartidaRoom.integration.test.ts` e `backend/src/game/baralho.test.ts` que representa "a Carta Super Trunfo" (comentários e código) vira `"6D"` -- ver Code Map pra lista completa dos ~25 pontos já mapeados.
- `backend/src/schema/Carta.ts:27`'s comentário (`// so a "2A" e' true`) é atualizado pra `"6D"`.

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- escopo e comportamento já totalmente determinados pela investigação prévia.

**Never:**
- Nenhuma mudança nas 2 ocorrências de `"6D"` JÁ EXISTENTES em `PartidaRoom.integration.test.ts` ANTES desta história (linhas ~1996 e ~2417, ver Code Map) -- são cartas comuns usadas por seus valores numéricos reais em cenários sem nenhuma relação com Super Trunfo; investigação confirmou que ficam seguras após a troca (a Carta é sempre jogada por um Jogador que NÃO é `jogadorDaVez` no momento, então nunca aciona `SuperTrunfoAcionado` -- ver `PartidaRoom.ts:397`, `ehSuperTrunfo = remetente.monte[0]?.superTrunfo === true`, só verifica quem está jogando ativamente). Trocar essas duas por engano quebraria os cenários de empate/eliminação que dependem dos valores numéricos reais do Jaguar ali.
- Nenhuma mudança em nenhuma outra coluna do CSV, nenhuma Carta adicionada/removida -- o Baralho continua com exatamente 32 Cartas e exatamente 1 com a flag Super Trunfo (invariantes já protegidos por `backend/src/game/baralho.ts`).
- Nenhuma mudança em `frontend/` -- as referências a `"2A"`/`"6D"` em `Carta.test.tsx`/`MesaDeJogo.test.tsx`/`CartaVerso.test.tsx`/`ia.test.ts`/`PartidaRoom.test.ts` são fixtures isoladas (não leem o CSV real), continuam funcionando sem alteração.

</frozen-after-approval>

## Code Map

- `docs/carros_specs.csv` -- linha `2A` (`SuperTrunfo` na coluna 4): `true`→`false`. Linha `6D`: `false`→`true`.
- `backend/src/schema/Carta.ts:27` -- comentário `// so a "2A" e' true (conteudo, nao decisao de codigo)` → `"6D"`.
- `backend/src/game/baralho.test.ts:47-52` -- `expect(superTrunfos[0].id).toBe("2A")` → `.toBe("6D")` (lê o CSV real via `carregarBaralho()`).
- `backend/src/rooms/PartidaRoom.integration.test.ts` -- 25 ocorrências de `"2A"` representando "a Carta Super Trunfo" (comentários e código), todas em cenários que **intencionalmente** forçam a Super Trunfo no topo de alguém pra testar o fluxo dela: linhas 601, 602, 627, 686, 688, 722, 754, 764, 765, 806, 816, 875, 880, 902, 919, 969, 973, 1993, 2277, 2282, 2317, 2385, 2798, 2801, 2822 (comentários + código nas mesmas ~8 cenários de teste). Cada uma vira `"6D"` -- inclui `embaralharOverride`/`forcarTopos` (força a Carta no topo), `expect(...id).toBe(...)` (confirma a premissa do cenário), e comentários explicativos.
  - **Exceção -- NÃO tocar:** `PartidaRoom.integration.test.ts:1987-1996` (teste "Matrix: vez pula o proprio Jogador recem-eliminado") e `:2417-2450` (teste "Matrix: IAs consecutivas") usam `"6D"` hoje como Carta comum qualquer (valores numéricos reais do Jaguar, comparação de Atributo normal) -- não têm relação com Super Trunfo, confirmado seguro após a troca (ver Boundaries "Never").

## Tasks & Acceptance

**Execution:**
- [x] `docs/carros_specs.csv` -- inverter `SuperTrunfo` entre `2A` e `6D`
- [x] `backend/src/schema/Carta.ts` -- atualizar comentário do campo `superTrunfo`
- [x] `backend/src/game/baralho.test.ts` -- atualizar a asserção que lê o ID da Carta Super Trunfo do CSV real
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- atualizar as 25 ocorrências de `"2A"` (código + comentários) listadas no Code Map, preservando intactas as 2 ocorrências pré-existentes de `"6D"` não relacionadas -- verificado linha por linha contra o diff real, todas as 25 corretas, as 2 exceções confirmadas intocadas

**Acceptance Criteria:**
- Given `docs/carros_specs.csv`, when os dados do Baralho são carregados, then a linha do Jaguar F-Type R (`6D`) tem `SuperTrunfo=true`, e a linha da Ferrari 812 Superfast (`2A`) tem `SuperTrunfo=false` (FR-29)
- Given o Baralho carregado, when validado, then continua com exatamente 32 Cartas e exatamente 1 com a flag Super Trunfo (invariantes de `backend/src/game/baralho.ts` inalterados)

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 67/67 verde (8 arquivos)
- `cd backend && npm run test:integration` -- 47/48 verde; a 1 falha (`MatchMakeError: fetch failed` em `testServer.connectTo`, teste de Funil sem relação com Super Trunfo) confirmada transiente -- reproduzida em isolamento (`-t`) e passou limpo. Todos os cenários de Super Trunfo (incluindo os 2 que usam `6D` por outro motivo, não tocados) passaram consistentemente em toda execução
- `npx tsc -b` (backend) -- limpo
- `npx playwright test --workers=1` (raiz) -- 10/10 verde
- Checagem manual do CSV: exatamente 32 linhas de dado, exatamente 1 com `SuperTrunfo=true` (`6D`), `2A` confirmado `false`

**Manual checks (if no CLI):**
- Abrir uma Partida e confirmar visualmente que a Carta com a moldura/glow de Super Trunfo agora é o Jaguar F-Type R, não mais a Ferrari 812 Superfast.

## Suggested Review Order

- Ponto de entrada: a troca de dado em si.
  [`carros_specs.csv:6`](../../docs/carros_specs.csv#L6)

- Comentário do schema, atualizado pra refletir o novo conteúdo.
  [`Carta.ts:27`](../../backend/src/schema/Carta.ts#L27)

- Asserção que lê o Baralho real e confirma a nova Carta Super Trunfo.
  [`baralho.test.ts:47`](../../backend/src/game/baralho.test.ts#L47)

- Os cenários de teste que dependem da identidade da Carta Super Trunfo -- vale conferir que as 2 exceções (linhas ~1996 e ~2417, não linkadas aqui de propósito) permaneceram intocadas.
  [`PartidaRoom.integration.test.ts:601`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L601)
