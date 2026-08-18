---
title: 'FAQ de Regras'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
baseline_commit: 'a8e9b8f20ed95d21a50d000d46a3cba2c003cb76'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Qualquer jogador (principalmente quem só conhece o jogo físico) pode ter dúvida sobre uma regra específica -- a exceção da carta letra "A" contra o Super Trunfo, como o Funil de desempate funciona, etc. -- e hoje não tem onde consultar isso dentro do app, só perguntando pra outra pessoa. `CriarSala.tsx` já tem um `<p className="faq-link">Como funciona? Ver FAQ de regras</p>` estático (texto sem ação, herdado do mockup da Story 1.2) esperando por isso.

**Approach:** Uma tela `FAQ` nova, só alcançável a partir da Tela Inicial (`CriarSala`) transformando esse texto estático num botão que abre a FAQ; nenhuma rota nova (`window.location`/URL inalterados) -- um toggle de estado local em `App.tsx`, no mesmo espírito "sem lib de rotas" já estabelecido (Story 1.2/1.3/2.6). Accordion de perguntas expansíveis (`<details>/<summary>` nativo -- foco/toggle de teclado de graça, sem JS de acessibilidade customizado) cobrindo as 5 áreas da Matrix abaixo. Botão "Voltar" fecha o toggle e retorna pra `CriarSala`, preservando o que a pessoa já tinha digitado no formulário (sem reload).

## Boundaries & Constraints

**Always:**
- O texto/botão em `CriarSala.tsx` (`faq-link`) precisa virar interativo (`<button>`, nunca `<a href>` -- não existe rota real) e chamar uma prop nova (`onAbrirFAQ`) que `App.tsx` passa.
- `App.tsx` controla a visibilidade da FAQ via um `useState` local (ex: `mostrarFAQ`), só relevante dentro do branch onde `room` ainda é `null` e não há `roomIdConvite` (o branch que hoje renderiza só `CriarSala`).
- Conteúdo da FAQ precisa ser factualmente correto conforme as regras já implementadas (não o texto solto do mockup) -- basear nos 32 registros do Baralho/7 Atributos (`atributos.ts`), na ordem circular do Super Trunfo a partir do próximo Jogador (`superTrunfo.ts`), e no Funil acumulando Cartas até o vencedor levar tudo (`comparacao.ts`/Story 2.5).

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Nenhuma mudança de backend/Colyseus -- conteúdo 100% estático, sem depender de `room`/`room.state`.
- A FAQ nunca aparece em nenhuma superfície de `SalaDeEspera`/`MesaDeJogo`/`FimDePartida` -- nenhum link/botão novo nessas telas.
- Nenhuma rota nova baseada em `window.location.pathname` -- toggle de estado local em `App.tsx` é suficiente (mesma filosofia das telas existentes).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Abrir a FAQ | Na Tela Inicial (`CriarSala`, `room` ainda `null`), clica "Como funciona? Ver FAQ de regras" | Tela `FAQ` substitui `CriarSala`; formulário preenchido até então (nome/totais) não é perdido, já que nenhum reload acontece | N/A |
| Conteúdo cobre as 5 áreas | Tela `FAQ` renderizada | Perguntas expansíveis cobrindo: estrutura do Baralho (32 Cartas, 7 Atributos comparáveis), o game loop (escolha de Atributo → revelação → comparação → coleta), a Carta Super Trunfo e a exceção da carta letra "A", o Funil de desempate, e o fim de jogo/eliminação | N/A |
| Voltar pra Tela Inicial | Na tela `FAQ`, clica "Voltar" | Volta pra `CriarSala`, no mesmo estado (`room` continua `null`) | N/A |
| FAQ nunca aparece na Mesa | `room` não é mais `null` (Sala de Espera, Partida em andamento, ou Fim de Partida) | Nenhuma superfície dessas telas mostra ou linka pra FAQ | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/CriarSala.tsx:60` -- `<p className="faq-link">` estático vira `<button type="button" className="faq-link" onClick={onAbrirFAQ}>`; nova prop `onAbrirFAQ: () => void` em `CriarSalaProps`
- `frontend/src/App.tsx:48-98` -- novo `const [mostrarFAQ, setMostrarFAQ] = useState(false)`; dentro do branch `!room` (hoje só `roomIdConvite ? <EntrarSala/> : <CriarSala/>`), se `!roomIdConvite && mostrarFAQ`, renderiza `<FAQ onVoltar={() => setMostrarFAQ(false)} />` em vez de `<CriarSala/>`; `CriarSala` recebe `onAbrirFAQ={() => setMostrarFAQ(true)}`
- `frontend/src/screens/FAQ.tsx` (novo) -- tela nova, lista de `<details>/<summary>` com as 5 perguntas; header com botão "Voltar" (prop `onVoltar: () => void`)
- `frontend/src/screens/FAQ.css` (novo) -- estilo conforme `mockups/key-faq.html` (header `--amarelo-primario`, item com borda `--hairline`, primeiro item com acento `--laranja-pop`, fundo `--papel-carta`) e `DESIGN.md` (tipografia de corpo padrão, sem efeitos decorativos de wordmark)
- `frontend/src/screens/CriarSala.css:23` -- `.faq-link` ganha `cursor: pointer`/reset de `<button>` (`border: none; background: none; font: inherit`), mantendo a aparência visual atual (texto sublinhado)
- `frontend/src/game/atributos.ts`, `superTrunfo.ts`, `comparacao.ts` (leitura apenas) -- fonte da verdade pro conteúdo textual da FAQ (7 Atributos incl. 1 inverso, ordem circular do Super Trunfo, mecânica de empate/Funil)

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/FAQ.tsx` + `FAQ.css` -- tela nova com accordion nativo (`<details>/<summary>`) cobrindo as 5 áreas da Matrix, header com "Voltar"
- [x] `frontend/src/screens/CriarSala.tsx` + `CriarSala.css` -- `faq-link` vira `<button>` interativo, nova prop `onAbrirFAQ`
- [x] `frontend/src/App.tsx` -- toggle de estado local `mostrarFAQ`, roteando pra `FAQ` em vez de `CriarSala` sem tocar `window.location`
- [x] Testes de componente (`FAQ.test.tsx`, ajustes em `CriarSala.test.tsx`, `App.test.tsx`) -- cobrem a Matrix inteira: abrir a FAQ a partir da Tela Inicial, conteúdo das 5 áreas presente, voltar preserva o formulário, e a FAQ nunca aparece uma vez que `room` existe
- [x] (achado da revisão) Ordem "FAQ aberta enquanto `criarSala()` ainda em voo" não estava coberta -- o botão da FAQ não fica `disabled` durante `criando` (diferente do botão "Criar Sala"), então existe um caminho real onde a FAQ abre e só depois `room` é criado; teste novo prova que o fragment inteiro (`CriarSala` + `FAQ`) some de uma vez, sem tela intermediária
- [x] (achado da revisão) Nenhum teste provava que o wrapper que esconde `CriarSala` (`.app-shell__oculto`) realmente ganha/perde a classe no momento certo -- `getByRole`/`queryByRole` acham elementos independente de `display: none` neste setup (sem `test.css: true`); teste novo asserta a classe diretamente via `toHaveClass`
- [x] (achado da revisão) Trocar de tela sem gerenciar foco perde a posição de quem navega por teclado/leitor de tela -- `FAQ.tsx` move o foco pro próprio `<h1>` ao montar; `CriarSala.tsx` devolve o foco ao botão "Como funciona?" quando a FAQ fecha (nova prop `mostrarFAQ`, `useEffect` na transição `true → false`)

**Acceptance Criteria:**
- Given estou na Tela Inicial (antes de criar ou entrar numa sala), when acesso a FAQ, then vejo uma lista de perguntas expansíveis cobrindo estrutura do Baralho, o game loop, a Carta Super Trunfo e sua exceção, o Funil de desempate, e o fim de jogo, e consigo voltar pra Tela Inicial a qualquer momento
- Given estou na Mesa de Jogo, numa Partida em andamento, when procuro a FAQ, then ela não aparece em nenhuma superfície da Mesa de Jogo -- só é alcançável pela Tela Inicial

## Design Notes

O texto/classe `faq-link` já existe em `CriarSala.tsx`/`CriarSala.css` desde a Story 1.2 (implementado direto do mockup `key-criar-sala.html`, que já mostrava essa linha, mas sem a FAQ existir ainda) -- esta história só precisa torná-lo funcional, não criar o gancho visual do zero.

Conteúdo da exceção do Super Trunfo: a ordem NÃO é "qualquer adversário com carta letra A" solto -- é circular a partir do próximo Jogador em ordem de entrada (`superTrunfo.ts`, `determinarVencedorSuperTrunfo`), primeira carta letra "A" encontrada nesse percurso vence; sem nenhuma, o Super Trunfo vence sem oposição. A resposta da FAQ deve refletir isso com precisão (evitar a simplificação do mockup, que fala só em "algum adversário").

`<details>/<summary>` nativo (em vez de um accordion custom com `useState`/JS) -- toggle de teclado (Enter/Espaço) e foco visível vêm de graça do navegador, batendo com o piso de acessibilidade do épico (`epic-4-context.md`) sem código extra.

**Correção pós-aprovação (revisão):** `CriarSala` fica permanentemente montada por baixo da FAQ (só escondida via CSS) em vez de desmontar/remontar -- decisão tomada pelo implementador na hora, não literal no Code Map original (que sugeria só "renderiza `<FAQ/>` em vez de `<CriarSala/>`"), mas necessária pra cumprir de verdade a Matrix "Abrir a FAQ" (formulário preenchido não é perdido): desmontar teria zerado o `useState` interno do formulário mesmo sem nenhum reload de página. Consequência que a revisão pegou e o mesmo round corrigiu: como o botão da FAQ nunca fica desabilitado durante `criando`, existe uma ordem real (abrir a FAQ enquanto `criarSala()` ainda está em voo) que não tinha teste -- agora coberta -- e o gerenciamento de foco na troca de tela (perdido por padrão numa SPA sem lib de rotas) precisou de código novo (`tabIndex`/`ref`/`useEffect` em `FAQ.tsx` e `CriarSala.tsx`) que não estava no Code Map original.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 108/108 verde (13 arquivos, inclui os testes novos de `FAQ.tsx` e os 4 testes adicionados na revisão)
- `npx tsc --noEmit` -- limpo
- `npx playwright test --workers=1` (raiz) -- 9/9 verde, incluindo `e2e/criar-sala.spec.ts` (sanity check do botão/foco da FAQ num navegador real)

**Manual checks (if no CLI):**
- Abrir a Tela Inicial, clicar "Como funciona? Ver FAQ de regras", conferir as 5 perguntas, clicar "Voltar" e confirmar que o formulário (se algo foi digitado antes) continua preenchido.

## Suggested Review Order

1. [App.tsx:62](../../frontend/src/App.tsx#L62) -- `mostrarFAQ`, o toggle local que substitui `CriarSala` por `FAQ` dentro do branch sem `room`, mantendo `CriarSala` sempre montada (só escondida via CSS)
2. [FAQ.tsx:72](../../frontend/src/screens/FAQ.tsx#L72) -- conteúdo das 5 perguntas (redigido a partir de `atributos.ts`/`superTrunfo.ts`/`comparacao.ts`, não do mockup) + gerenciamento de foco no mount
3. [CriarSala.tsx:34](../../frontend/src/screens/CriarSala.tsx#L34) -- botão `faq-link` interativo + devolução de foco na transição `mostrarFAQ: true → false` (achado da revisão)
4. [App.test.tsx](../../frontend/src/App.test.tsx) -- describe `"App -- toggle da FAQ (Story 4.1)"` (procurar pelo texto), 5 testes incluindo os 3 adicionados na revisão (ordem FAQ-antes-do-room, classe do wrapper, foco)
