---
title: 'Resultado da Rodada Sempre Visível'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '58359e12bbde3a72680a79783decd59e30c52163'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O Chip de Resultado da Rodada (`MesaDeJogo.tsx`, `data-testid="chip-resultado"`) é renderizado por último no JSX -- depois dos oponentes, do Funil e da própria Carta -- sem `position: fixed`/`sticky` no CSS, então nasce abaixo da dobra em qualquer viewport que não caiba tudo de uma vez (a maioria dos celulares, e até desktop com zoom). A pausa de revelação é de só 2500ms (`DURACAO_REVELACAO_MS`, `PartidaRoom.ts`) -- tempo insuficiente pra rolar a página até ele. Resultado: quem ganhou a Rodada, a mecânica central do jogo, fica invisível na maioria das vezes.

**Approach:** Puramente CSS/posicionamento, sem nenhuma mudança de backend. O Chip de Resultado da Rodada (só essa instância -- nunca o Chip "Eliminado" nem o Banner de Vitória de `FimDePartida.tsx`, que reusam a mesma classe base `.chip-resultado`) ganha uma classe modificadora nova e escopada, com `position: fixed` centralizado na viewport (topo ou centro), visível instantaneamente assim que a Rodada resolve, em qualquer tamanho de tela.

## Boundaries & Constraints

**Always:**
- A correção mira SÓ o Chip de Resultado de Rodada em `MesaDeJogo.tsx` (`data-testid="chip-resultado"`, o `<div className="chip-resultado chip-resultado--vitoria">` renderizado após `ultimoResultado.vencedorNome`) -- via uma classe modificadora NOVA (ex: `chip-resultado--overlay`), nunca alterando a classe base `.chip-resultado` nem `.chip-resultado--vitoria` diretamente (essas são compartilhadas com o Chip "Eliminado" no assento do oponente e com o Banner de Vitória em `FimDePartida.tsx`, UX-DR8).
- O Chip precisa ficar visível sem exigir rolagem, tanto em mobile quanto em desktop (NFR-4), e permanecer legível durante toda a janela de revelação (2,5s).
- Zero mudança de backend -- `PartidaRoom.ts`/`DURACAO_REVELACAO_MS` inalterados.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Nunca alterar o posicionamento/CSS do Chip "Eliminado" (`.mesa-de-jogo__oponente .chip-resultado`) nem do Banner de Vitória (`FimDePartida.tsx`, `chip-resultado--vitoria` em `data-testid="banner-vitoria"`) -- ambos continuam exatamente como estão.
- Nenhuma mudança na duração da pausa de revelação (`DURACAO_REVELACAO_MS`) nem em qualquer lógica de `resolverRodada`/`PartidaRoom.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Resultado sem empate (viewport pequena) | Rodada resolve sem empate, `ultimoResultado.vencedorNome` preenchido, viewport mobile (ex: 375px de largura, altura curta) | Chip de Resultado aparece imediatamente visível, sem exigir rolagem | N/A |
| Resultado sem empate (viewport grande) | Mesmo cenário, viewport desktop | Chip de Resultado aparece imediatamente visível, sem exigir rolagem | N/A |
| Chip "Eliminado" de oponente inalterado | Um oponente tem `quantidadeCartas === 0` | Continua no mesmo lugar/tamanho de sempre (dentro da coluna do oponente, 72px), sem virar overlay | N/A |
| Banner de Vitória inalterado | `estado === "FimDePartida"`, `FimDePartida.tsx` renderiza o Banner de Vitória | Continua no mesmo lugar de sempre (fluxo normal da tela, não overlay), sem herdar o novo modificador | N/A |
| Empate (sem Chip) | Rodada empata, `ultimoResultado.vencedorNome` vazio | Nenhum Chip aparece (comportamento já existente, inalterado) | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/MesaDeJogo.tsx:330-340` -- bloco `{ultimoResultado && ultimoResultado.vencedorNome && (...)}`, `className="chip-resultado chip-resultado--vitoria"` ganha uma terceira classe (ex: `chip-resultado--overlay`)
- `frontend/src/screens/MesaDeJogo.css:96-146` -- `.chip-resultado`/`.chip-resultado--vitoria` (classes base, NÃO tocar); nova regra `.chip-resultado--overlay` com `position: fixed`, centralizado, `z-index` alto o bastante pra ficar acima de Carta/Funil/oponentes
- `frontend/src/screens/MesaDeJogo.css:150-158` -- `.mesa-de-jogo__oponente .chip-resultado` (Chip "Eliminado" compacto, NÃO tocar -- confirma que o novo modificador não é aplicado ali)
- `frontend/src/screens/FimDePartida.tsx`/`FimDePartida.css` (leitura apenas) -- confirma que o Banner de Vitória usa só `chip-resultado chip-resultado--vitoria`, sem o novo modificador, então fica exatamente como está

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- Chip de Resultado de Rodada ganha a classe modificadora nova
- [x] `frontend/src/screens/MesaDeJogo.css` -- nova regra `.chip-resultado--overlay` (position fixed, centralizado, sempre visível, mobile+desktop)
- [x] Teste de componente (`MesaDeJogo.test.tsx`) -- confirma a classe nova presente no Chip de Resultado de Rodada; confirma que o Chip "Eliminado" de oponente NÃO ganha a classe nova
- [x] Confirmação manual/E2E de que `FimDePartida.tsx` continua renderizando o Banner de Vitória sem a classe nova (nenhum teste existente deve quebrar) -- reforçado com asserção dedicada em `FimDePartida.test.tsx` (achado da revisão)
- [x] (achado da revisão -- verification-gap) Nenhum teste provava o efeito visual/posicional de verdade -- jsdom não aplica layout, e o `toBeVisible()` do Playwright existente passa mesmo fora da viewport. Novo teste E2E (`e2e/mesa-de-jogo.spec.ts`) abre uma viewport estreita (375x600, o cenário do bug original) e usa `toBeInViewport()` -- verificado manualmente que esse teste FALHA se `.chip-resultado--overlay` perder o `position: fixed` (reintroduzindo o bug original), confirmando que ele realmente prova a correção
- [x] (achado da revisão -- blind-hunter/edge-case-hunter) `pointer-events: none` no overlay (é puramente informativo e podia coincidir na tela com a Linha de Atributo clicável do vencedor), `max-height`/`overflow-y` no overlay e `overflow-wrap: anywhere` no texto (protege contra um nome de Jogador incomum crescendo o Chip a ponto de cobrir o resto da Mesa), e o `z-index: 1000` virou token (`--z-overlay`, `index.css`) em vez de número mágico

**Acceptance Criteria:**
- Given uma Rodada acabou de resolver sem empate, when o Chip de Resultado aparece, then ele fica visível na tela sem exigir rolagem, tanto em mobile quanto em desktop
- Given o Chip de Resultado está visível, when a janela de revelação (2,5s) ainda está em andamento, then ele permanece legível o tempo todo, mesmo que o resto da Mesa não caiba na viewport
- Given um oponente foi eliminado (`quantidadeCartas === 0`) OU a Partida terminou (`FimDePartida.tsx`), when esses Chips renderizam, then continuam exatamente com o posicionamento/estilo de antes desta história

## Design Notes

`position: fixed` é suficiente aqui -- o Chip de Resultado não precisa coexistir com scroll do usuário nem ser dispensável manualmente. Overlay simples, sem necessidade de portal/modal library.

**Correção pós-aprovação (revisão):** a afirmação acima de que o Chip "já some sozinho quando a próxima Rodada começa e `ultimoResultado` é limpo por `resolverRodada`" só é estritamente verdadeira no branch de EMPATE (`PartidaRoom.ts`, `vencedorNome`/`atributo` zerados só ali) -- em Rodadas consecutivas SEM empate, `ultimoResultado` nunca é limpo entre elas, só sobrescrito quando a Rodada seguinte resolve. Antes desta história isso era inofensivo (o Chip ficava invisível abaixo da dobra a maior parte do tempo); depois dela, o mesmo dado "velho" fica fixado no topo da tela durante toda a Rodada seguinte. Achado real da revisão (blind-hunter), confirmado lendo `PartidaRoom.ts` -- mas o conserto exige mudar `resolverRodada`, que o Boundaries desta história proíbe explicitamente (bugfix "puramente CSS"). Registrado em `deferred-work.md` como candidato a história futura dedicada, não bloqueou esta.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 109/109 verde
- `npx playwright test --workers=1` (raiz) -- 10/10 verde, incluindo o teste novo de viewport estreita (375x600) com `toBeInViewport()`
- Sanity check da revisão: reintroduzido temporariamente `position: static !important` em `.chip-resultado--overlay` -- o teste E2E novo falhou como esperado ("viewport ratio 0"); revertido antes de finalizar, diff conferido de volta idêntico ao original

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo numa viewport de celular estreita (DevTools, ~375x600), jogar uma Rodada, e confirmar visualmente que o resultado aparece sem precisar rolar.

## Suggested Review Order

1. [MesaDeJogo.css:130-166](../../frontend/src/screens/MesaDeJogo.css#L130-L166) -- a regra `.chip-resultado--overlay` (position fixed, pointer-events, max-height, z-index via token)
2. [MesaDeJogo.tsx:337-349](../../frontend/src/screens/MesaDeJogo.tsx#L337-L349) -- o Chip de Resultado ganhando a terceira classe, comentário explicando o escopo
3. [index.css:34-40](../../frontend/src/index.css#L34-L40) -- token `--z-overlay` novo
4. [e2e/mesa-de-jogo.spec.ts:327](../../e2e/mesa-de-jogo.spec.ts#L327) -- o teste que realmente prova a correção (`toBeInViewport()` em viewport estreita, achado da revisão)
5. [FimDePartida.test.tsx](../../frontend/src/screens/FimDePartida.test.tsx) -- asserção nova garantindo que o Banner de Vitória nunca herda `--overlay`
