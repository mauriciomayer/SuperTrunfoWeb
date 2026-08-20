---
title: 'Nome do Carro na Carta'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '2bc65472914c99cf00492bd0c2c48cf298f3c9d4'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O nome do modelo do carro não aparece em nenhum lugar da Carta hoje -- foi removido deliberadamente na Story 2.1. O jogador precisa decorar o código Grupo/Letra pra saber qual carro é qual.

**Approach:** Reverter essa decisão: mostrar o nome do modelo entre a foto e a primeira Linha de Atributo (Velocidade Máxima). A coluna `Modelo` já existe em `docs/carros_specs.csv` mas nunca foi lida por `baralho.ts` nem existe no schema -- precisa entrar no pipeline inteiro (CSV → schema → `baralho.ts` → frontend `CartaFrente` → `Carta.tsx`), no mesmo padrão já usado pela Story 5.4 (campo `imagem`).

## Boundaries & Constraints

**Always:**
- `docs/carros_specs.csv` não muda -- a coluna `Modelo` já existe e já está preenchida nas 32 linhas.
- `backend/src/schema/Carta.ts` ganha `@type("string") modelo: string = "";`; `backend/src/game/baralho.ts` propaga `registro["Modelo"]`; `frontend/src/components/Carta.tsx`'s `CartaFrente` ganha `modelo: string` (espelhando o schema, AD-10).
- `backend/src/rooms/PartidaRoom.ts`'s `clonarCarta` precisa copiar o campo novo (`copia.modelo = original.modelo;`) -- Story 5.4 já teve exatamente esse bug esquecido aqui (foto sumindo durante `Revelando`), não repetir.
- O nome renderiza entre `.carta-frente__foto` e `.carta-frente__atributos` (`Carta.tsx`), tanto na própria Carta quanto na de oponente, em qualquer estado de revelação.
- Nomes longos (ex: "Lamborghini Aventador LP 780-4 Ultimae", 38 caracteres) precisam continuar legíveis mesmo na Carta de oponente (140px de largura, `MesaDeJogo.css`) -- quebra de linha ou fonte pequena o suficiente, decisão de CSS a critério de quem implementa, mas sem cortar o texto sem indicação nenhuma (ex: `text-overflow: ellipsis` sozinho, sem `title` com o nome completo, seria uma perda de informação).

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- reversão de decisão de design já aprovada pelo Mauricio, campo de dado já existe no CSV.

**Never:**
- Nenhuma mudança em `docs/carros_specs.csv` nem nos outros campos do schema/pipeline.
- Nenhuma mudança em Story 5.4 (fotos) nem Story 5.2 (bandeiras) -- elementos visuais diferentes da mesma Carta.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nome curto | `carta.modelo` = "Ford GT" | Aparece entre a foto e a primeira Linha de Atributo | N/A |
| Nome longo | `carta.modelo` = "Lamborghini Aventador LP 780-4 Ultimae" (38 caracteres, o mais longo do Baralho real) | Continua legível na Carta de oponente (140px), sem cortar sem indicação | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/schema/Carta.ts:26` -- adicionar `@type("string") modelo: string = "";` (ex: ao lado de `pais`, mesmo padrão de campo string simples).
- `backend/src/game/baralho.ts:73-74` -- adicionar `carta.modelo = registro["Modelo"];` junto dos outros campos (a coluna `Modelo` já é parseada em `registro` pelo `forEach` existente, só falta ser lida).
- `backend/src/rooms/PartidaRoom.ts:25-41` (`clonarCarta`) -- adicionar `copia.modelo = original.modelo;`.
- `backend/src/game/baralho.test.ts` -- `CABECALHO_CSV` já inclui `Modelo` (nenhuma mudança de fixture necessária, ao contrário da Story 5.4); as linhas de fixture existentes (`escreverCsvTemporario`) já têm valores não-vazios ("Carro X", "Carro Y", "Carro"). Adicionar um teste confirmando que todas as 32 Cartas do CSV real têm `modelo` não-vazio (mesmo padrão do teste equivalente da Story 5.4 pra `imagem`).
- `backend/src/rooms/PartidaRoom.test.ts:60-70` (`criarCartaDeExemplo`, fixture de `clonarCarta`) -- adicionar `carta.modelo = "..."` pra cobrir o campo novo no teste de campo-por-campo.
- `frontend/src/components/Carta.tsx:12-25` (`CartaFrente`) -- adicionar `modelo: string;`. Entre `</div>` de `.carta-frente__foto` (linha ~271) e `<dl className="carta-frente__atributos">` (linha ~272) -- novo elemento (ex: `<p className="carta-frente__modelo">{carta.modelo}</p>`) mostrando o nome.
- `frontend/src/components/Carta.css` -- novo estilo pro elemento de nome, entre os blocos `.carta-frente__foto*` e `.carta-frente__atributos` -- fonte pequena o suficiente e/ou quebra de linha pra caber nomes longos na Carta de oponente (140px, `MesaDeJogo.css:44`).
- `frontend/src/components/Carta.test.tsx` / `frontend/src/screens/MesaDeJogo.test.tsx` -- as funções `criarCartaFalsa` de fixture ganham `modelo: "..."` no objeto base; novos testes cobrindo a Matrix (nome curto aparece, nome longo continua legível/não cortado sem indicação).

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/schema/Carta.ts` -- adicionar campo `modelo: string`
- [x] `backend/src/game/baralho.ts` -- propagar `registro["Modelo"]` pro campo `modelo` da Carta
- [x] `backend/src/rooms/PartidaRoom.ts` -- `clonarCarta` copia o campo `modelo`
- [x] `backend/src/game/baralho.test.ts` -- novo teste confirmando `modelo` preenchido em todas as 32 Cartas do CSV real
- [x] `backend/src/rooms/PartidaRoom.test.ts` -- fixture de `clonarCarta` cobre o campo `modelo`
- [x] `frontend/src/components/Carta.tsx` -- adicionar `modelo` à `CartaFrente`; renderizar o nome entre a foto e a primeira Linha de Atributo
- [x] `frontend/src/components/Carta.css` -- estilo do nome, legível em Cartas de oponente (140px) mesmo com nomes longos
- [x] `frontend/src/components/Carta.test.tsx` / `MesaDeJogo.test.tsx` -- testes cobrindo a Matrix: nome curto renderiza, nome longo continua acessível (sem corte sem indicação)
- [x] (achado da revisão) `backend/src/game/baralho.ts`'s `parsearLinha` tinha um comentário que ficou factualmente falso após esta história (dizia que `Modelo` "nem chega a ser usado aqui") -- corrigido
- [x] (achado da revisão) O teste novo de `modelo` só conferia não-vazio -- um bug de coluna deslocada (`modelo` recebendo o valor de `Pais` por engano) passaria despercebido, já que todas as colunas do CSV real são não-vazias. Reforçado com uma asserção de unicidade (32 valores distintos), espelhando o padrão já usado pro `id` no mesmo describe block

**Acceptance Criteria:**
- Given qualquer Carta renderizada (própria ou de oponente, em qualquer estado de revelação), when ela aparece na tela, then o nome do modelo do carro é exibido entre a foto e a primeira Linha de Atributo (Velocidade Máxima) (FR-31)

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 68/68 verde (8 arquivos), incluindo o teste de `modelo` preenchido + único por Carta
- `cd frontend && npm test` -- 133/133 verde (13 arquivos)
- `npx tsc -b` (frontend e backend) -- limpo nos dois
- `npx playwright test --workers=1` (raiz) -- 10/10 verde (1 flake ambiental documentado ao longo do projeto, `MatchMakeError`/timeout em teste de Sala de Espera não relacionado, confirmado transiente via reexecução isolada)
- Verificação manual do layout: renderizado o CSS real (`.carta-frente__modelo`) num HTML isolado em 140px de largura (a mesma da Carta de oponente) com o nome mais longo do Baralho real -- quebra em 3 linhas, totalmente legível, sem corte

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo e confirmar visualmente que o nome do carro aparece em todas as Cartas (própria e de oponentes), incluindo um nome longo como "Lamborghini Aventador LP 780-4 Ultimae", sem quebrar o layout.

## Suggested Review Order

**Pipeline de dados (CSV já tinha -> schema -> frontend)**

- Ponto de entrada: propagação do CSV pro schema da Carta.
  [`baralho.ts:74`](../../backend/src/game/baralho.ts#L74)

- Schema Colyseus: novo campo sincronizado pra qualquer cliente.
  [`Carta.ts:29`](../../backend/src/schema/Carta.ts#L29)

- `clonarCarta` copia o campo novo -- exatamente o ponto que a Story 5.4 esqueceu pro campo `imagem`, não repetido aqui.
  [`PartidaRoom.ts:32`](../../backend/src/rooms/PartidaRoom.ts#L32)

**Renderização no frontend**

- O nome renderiza entre a foto e a primeira Linha de Atributo, com `title` como fallback de acessibilidade.
  [`Carta.tsx:276`](../../frontend/src/components/Carta.tsx#L276)

- Estilo: quebra de linha em vez de corte, legível mesmo nos 140px da Carta de oponente.
  [`Carta.css:143`](../../frontend/src/components/Carta.css#L143)

**Testes**

- (achado da revisão) Asserção de unicidade fecha o gap de "coluna deslocada passaria despercebida".
  [`baralho.test.ts:84`](../../backend/src/game/baralho.test.ts#L84)

- Cobertura de componente: ordem no DOM via `compareDocumentPosition`, nome longo sem corte, ambos os estados clicável/não-clicável.
  [`Carta.test.tsx:152`](../../frontend/src/components/Carta.test.tsx#L152)
