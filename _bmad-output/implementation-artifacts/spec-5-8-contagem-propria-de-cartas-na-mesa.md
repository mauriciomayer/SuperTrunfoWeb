---
title: 'Contagem Própria de Cartas na Mesa'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '78217bcd9bccdf985256733fb2cfb1c5914a40b1'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O jogador não vê a própria contagem de Cartas na Mesa de Jogo -- os oponentes já mostram a contagem deles (`oponente.quantidadeCartas`), mas a seção "minha carta" (`frontend/src/screens/MesaDeJogo.tsx`) nunca renderiza `meuJogador.quantidadeCartas`, mesmo o dado já chegando do backend via Colyseus.

**Approach:** Adicionar a contagem própria na seção `.mesa-de-jogo__minha-carta`, no mesmo padrão visual/textual já usado pra contagem dos oponentes ("N carta"/"N cartas"). Puramente frontend -- o dado já existe no estado local, só falta ser exibido.

## Boundaries & Constraints

**Always:**
- Mesmo texto/pluralização já usado pro oponente: `` `${quantidadeCartas} carta${quantidadeCartas === 1 ? "" : "s"}` ``.
- A contagem aparece independente do estado da própria Carta (com Carta revelada, Carta virada, `ChipEliminado`, ou "Preparando sua carta…") -- mesmo padrão do oponente, cujo `.mesa-de-jogo__oponente-contagem` renderiza sempre, fora do condicional que decide qual elemento de Carta mostrar.
- `.mesa-de-jogo__minha-carta` hoje é `display: flex` em linha (sem `flex-direction: column`) -- ao contrário de `.mesa-de-jogo__oponente`, que já empilha Carta/nome/contagem verticalmente. Precisa de ajuste de CSS pra empilhar a Carta e a contagem nova (mesmo padrão vertical), não só adicionar o texto num layout que não foi pensado pra isso.

**Ask First:**
- Nenhuma decisão depende de aprovação humana durante a execução -- escopo puramente aditivo e visual, dado já disponível.

**Never:**
- Nenhuma mudança no backend nem no schema -- `quantidadeCartas` já existe e já chega corretamente pro cliente.
- Nenhum nome próprio adicionado ao lado da contagem (ao contrário do oponente, que mostra nome -- o jogador já sabe quem é ele mesmo; a AC pede só a contagem).
- Nenhuma mudança na seção de oponentes (`.mesa-de-jogo__oponente*`) nem no Funil.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Contagem normal | `meuJogador.quantidadeCartas` = 16 | Mostra "16 cartas" | N/A |
| Contagem singular | `meuJogador.quantidadeCartas` = 1 | Mostra "1 carta" (sem "s") | N/A |
| Eliminado | `meuJogador.quantidadeCartas` = 0 (Chip "Eliminado" visível) | Contagem "0 cartas" continua visível junto do Chip | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/MesaDeJogo.tsx:316-330` (`.mesa-de-jogo__minha-carta`) -- adicionar um `<span>` de contagem (ex: `className="mesa-de-jogo__minha-contagem"`) com `` {meuJogador?.quantidadeCartas ?? 0} carta{...} ``, fora do bloco condicional que decide `ChipEliminado`/`Carta`/"Preparando…", mesmo padrão de `.mesa-de-jogo__oponente-contagem` (linhas 306-308).
- `frontend/src/screens/MesaDeJogo.css:64-72` (`.mesa-de-jogo__minha-carta`) -- ganha `flex-direction: column; align-items: center; gap: var(--espaco-1);` (mesmo padrão de `.mesa-de-jogo__oponente`, linhas 28-34) pra empilhar a Carta e a contagem nova em vez de ficarem lado a lado no layout `flex` em linha atual. Novo estilo pra `.mesa-de-jogo__minha-contagem` -- fonte/cor podem reaproveitar `.mesa-de-jogo__oponente-contagem` (linhas 58-62), ajustado se o tamanho maior da própria Carta (até 320px) pedir algo ligeiramente diferente -- decisão de detalhe a critério de quem implementa.
- `frontend/src/screens/MesaDeJogo.test.tsx` -- nenhum teste hoje cobre `oponente-contagem` nem a ausência da contagem própria; novos testes cobrindo a Matrix (contagem normal, singular "1 carta", contagem visível junto do Chip Eliminado).

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/MesaDeJogo.tsx` -- adicionar a contagem própria em `.mesa-de-jogo__minha-carta`, mesmo padrão textual do oponente, sempre visível independente do estado da Carta
- [x] `frontend/src/screens/MesaDeJogo.css` -- `.mesa-de-jogo__minha-carta` empilha verticalmente (Carta + contagem); novo estilo pra `.mesa-de-jogo__minha-contagem`
- [x] `frontend/src/screens/MesaDeJogo.test.tsx` -- testes cobrindo a Matrix: contagem normal, singular, contagem visível com Chip Eliminado
- [x] (achado da revisão, corroborado por 2 revisores independentes) A implementação precisou desambiguar um teste pré-existente que agora colidia com "10 cartas" aparecendo também na nova contagem própria -- a correção inicial só contava elementos DOM (`querySelectorAll(...).toHaveLength(2)`), perdendo a checagem de texto que o teste original tinha. Restaurada via `within(oponentes).getAllByText("10 cartas")`, escopando a query em vez de enfraquecer a asserção

**Acceptance Criteria:**
- Given estou na Mesa de Jogo numa Partida em andamento, when olho pra minha própria área da Mesa, then vejo minha contagem atual de Cartas (FR-32), no mesmo padrão visual usado pra contagem dos oponentes

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 137/137 verde (13 arquivos), `MesaDeJogo.test.tsx` com 38 testes
- `npx tsc -b` (frontend) -- limpo
- `npx playwright test --workers=1` (raiz) -- 10/10 verde (1 flake ambiental documentado ao longo do projeto, timeout de "Sala de Espera" num teste não relacionado, confirmado transiente via reexecução isolada)

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo e confirmar visualmente que a própria contagem de Cartas aparece abaixo da própria Carta, no mesmo estilo visual da contagem dos oponentes.

## Suggested Review Order

- Ponto de entrada: a contagem própria, sempre visível fora do condicional de estado da Carta -- mesmo padrão da contagem do oponente.
  [`MesaDeJogo.tsx:337`](../../frontend/src/screens/MesaDeJogo.tsx#L337)

- Layout: `.mesa-de-jogo__minha-carta` passa a empilhar verticalmente (antes era uma linha pensada só pra Carta).
  [`MesaDeJogo.css:70`](../../frontend/src/screens/MesaDeJogo.css#L70)

- (achado da revisão) O teste pré-existente do oponente foi corrigido pra continuar checando o texto renderizado, não só a contagem de elementos DOM.
  [`MesaDeJogo.test.tsx:140`](../../frontend/src/screens/MesaDeJogo.test.tsx#L140)

- Cobertura da Matrix: plural, singular, e visibilidade junto do Chip Eliminado.
  [`MesaDeJogo.test.tsx:967`](../../frontend/src/screens/MesaDeJogo.test.tsx#L967)
