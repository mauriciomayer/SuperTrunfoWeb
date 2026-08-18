---
title: 'Compartilhar Link da Sala'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: 'bc219410664a4a21d54456bcc40841775fb5dd2c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O link de convite da sala já aparece na Sala de Espera (`frontend/src/screens/SalaDeEspera.tsx`), mas não existe nenhum mecanismo de cópia -- o usuário precisa selecionar o texto manualmente, o que é uma fricção desnecessária pra compartilhar com família e amigos.

**Approach:** Adicionar um botão "Copiar link" ao lado do texto do link de convite, usando a Clipboard API do navegador (`navigator.clipboard.writeText`), com confirmação visual temporária (ex: texto do botão muda pra "Copiado!" por alguns segundos e volta ao normal).

## Boundaries & Constraints

**Always:**
- O botão fica visível pra qualquer jogador na Sala de Espera (host ou convidado) -- todos podem querer reenviar o link, não só o host.
- O link copiado é exatamente o mesmo texto já exibido (`linkConvite`, `${window.location.origin}/sala/${room.roomId}`) -- nenhuma mudança no formato do link em si.
- A confirmação visual precisa ser perceptível mas temporária (reverte sozinha após um tempo curto, ex: 2000ms) -- nunca um estado permanente que exija ação do usuário pra sair dele.
- Falha da Clipboard API (ex: `navigator.clipboard` indisponível em contexto não-seguro, ou a Promise rejeita) precisa ser tratada sem quebrar a tela -- sem crash, com algum feedback de que a cópia não funcionou (ex: `console.error` no mínimo; texto de erro visível é bônus, não obrigatório).

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução -- mudança isolada de UI/UX na Sala de Espera, sem impacto em backend, schema ou outras telas.

**Never:**
- Nenhuma mudança no backend (`PartidaRoom.ts`, schemas) nem no formato/geração do link -- ele já existe e já é correto hoje.
- Nenhuma mudança em Story 5.1 (Chip de Resultado) nem Story 5.2 (bandeiras) -- telas e componentes diferentes.
- Nenhuma introdução de dependência nova (ex: lib de "toast") -- a confirmação visual usa state local do próprio componente, no mesmo padrão já usado por `enviado` neste arquivo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cópia bem-sucedida | Usuário clica em "Copiar link", `navigator.clipboard.writeText` resolve | Link vai pra área de transferência; botão mostra confirmação temporária (ex: "Copiado!") por alguns segundos, depois volta ao texto original | N/A |
| Clipboard API indisponível ou rejeita | `navigator.clipboard` é `undefined`, ou `writeText` rejeita a Promise | Tela não quebra; erro é logado (`console.error`); botão não fica preso num estado de "Copiado!" falso | Captura via `try/catch` (ou `.catch`) ao redor da chamada assíncrona |
| Cliques repetidos rápidos | Usuário clica em "Copiar link" várias vezes seguidas antes do timeout da confirmação anterior expirar | Cada clique tenta copiar de novo; a confirmação visual não gera múltiplos timers conflitantes que causem comportamento inconsistente (ex: timer antigo revertendo o texto depois de um clique novo) | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/SalaDeEspera.tsx:108-110` -- o `<p className="link-convite" data-testid="link-convite">` que hoje só exibe o texto do link; ganha um botão irmão (ex: dentro do mesmo container, ou logo abaixo) que copia `linkConvite` (já calculado na linha 94: `` `${window.location.origin}/sala/${room.roomId}` ``) via `navigator.clipboard.writeText`. Novo state local (ex: `const [copiado, setCopiado] = useState(false)`) controla o texto/rótulo do botão, com `setTimeout` revertendo após ~2000ms -- limpar o timer anterior a cada novo clique (guardar o id do timer, ex: em `useRef`, e chamar `clearTimeout` antes de agendar outro) pra cobrir o cenário de cliques repetidos da Matrix.
- `frontend/src/screens/SalaDeEspera.css:31-41` -- `.link-convite` já estiliza o texto do link; precisa de um estilo novo pro botão de copiar (reaproveitar tokens já usados no arquivo, ex: `--espaco-*`, `--raio-sm`, `--hairline`/`--vermelho-pop` conforme o visual desejado -- decisão de estilo fica a critério de quem implementa, mantendo o padrão mobile-first já usado em `.sala-de-espera .btn-primario`).
- `frontend/src/screens/SalaDeEspera.test.tsx` -- já tem o helper `criarRoomFalso` e o padrão de testar via `fireEvent`/`screen`; novos testes cobrem clique copiando o texto certo, feedback visual aparecendo e revertendo, e o caso de falha da Clipboard API sem quebrar a tela.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/SalaDeEspera.tsx` -- adicionar botão "Copiar link" que chama `navigator.clipboard.writeText(linkConvite)`, com state local de confirmação temporária revertendo via `setTimeout` (limpando timer anterior em cliques repetidos) -- FR-27
- [x] `frontend/src/screens/SalaDeEspera.css` -- estilo do novo botão, consistente com o design system já usado no arquivo (tokens `--espaco-*`/`--raio-sm`/cores existentes)
- [x] `frontend/src/screens/SalaDeEspera.test.tsx` -- testes cobrindo a Matrix: cópia bem-sucedida (mock de `navigator.clipboard.writeText`, assert do texto copiado e do feedback visual aparecendo/revertendo com fake timers), falha da Clipboard API (mock rejeitando, assert que não quebra e loga erro), cliques repetidos (assert que não fica em estado inconsistente)
- [x] (achado da revisão -- edge case, encontrado independentemente por dois revisores) Corrida de clique duplo: dois cliques antes do primeiro `writeText` resolver disparavam duas chamadas sobrepostas, cada uma agendando seu próprio `setTimeout`, com a segunda pisando na referência da primeira e órfão-izando o timer do primeiro clique. Corrigido com `copiandoRef` (guarda síncrona "cópia em andamento", `SalaDeEspera.tsx:93`), com teste reproduzindo o clique duplo sobreposto via Promise controlada manualmente
- [x] (achado da revisão -- acessibilidade, encontrado independentemente por dois revisores) A confirmação "Copiado!" só era transmitida pela troca do texto do próprio botão -- inaudível pra leitor de tela se o foco não estiver no botão no momento. Adicionado `aria-live="polite"` (`SalaDeEspera.tsx:183`)
- [x] (achado da revisão -- polish visual) O botão mudava de largura a cada clique (rótulos "Copiar link"/"Copiado!" têm comprimentos diferentes), causando salto de layout. Adicionado `min-width: 118px` (`SalaDeEspera.css:57`)

**Acceptance Criteria:**
- Given estou na Sala de Espera (host ou convidado) com o link de convite visível, when clico no botão de copiar, then o link é copiado pra área de transferência (FR-27) e recebo uma confirmação visual de que a cópia funcionou
- Given a confirmação visual está ativa, when o tempo de exibição passa, then o botão volta ao texto/estado original, pronto pra nova cópia

## Design Notes

O botão pode reaproveitar o mesmo container do `<p className="link-convite">` (ex: envolver os dois num `<div>` com `display: flex`) ou ficar logo abaixo -- decisão de layout fica a critério de quem implementa, desde que o link e o botão apareçam próximos visualmente e o botão seja alcançável sem rolagem em mobile (mesma preocupação de acessibilidade da Story 5.1).

Fake timers (`vi.useFakeTimers()`) são o caminho natural pra testar o `setTimeout` de reversão sem esperar tempo real no teste.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 126/126 verde (13 arquivos), `SalaDeEspera.test.tsx` com 10 testes (5 novos: 4 da implementação inicial + 1 do patch de revisão)
- `npx tsc -b` -- limpo
- `npx playwright test --workers=1` (raiz) -- 10/10 verde, incluindo os 2 testes de `sala-de-espera.spec.ts` (nenhum quebrou com a reestruturação do DOM em `.link-convite-linha`, já que usam `getByTestId("link-convite")` que continua resolvendo pro mesmo `<p>`)

**Manual checks (if no CLI):**
- Abrir a Sala de Espera num navegador, clicar em "Copiar link", colar em outro campo e confirmar que o texto colado é idêntico ao link exibido.

## Suggested Review Order

**Cópia do link e confirmação temporária**

- Ponto de entrada: o handler de clique que copia o link e agenda a reversão do rótulo do botão.
  [`SalaDeEspera.tsx:134`](../../frontend/src/screens/SalaDeEspera.tsx#L134)

- Guarda "cópia em andamento" (achado da revisão) -- evita que dois cliques sobrepostos agendem dois timers conflitantes.
  [`SalaDeEspera.tsx:93`](../../frontend/src/screens/SalaDeEspera.tsx#L93)

- `aria-live="polite"` (achado da revisão) -- garante que leitores de tela anunciem "Copiado!" mesmo sem foco no botão.
  [`SalaDeEspera.tsx:183`](../../frontend/src/screens/SalaDeEspera.tsx#L183)

- Botão e container flex que colocam o botão ao lado do texto do link, sem quebrar o `data-testid` existente.
  [`SalaDeEspera.tsx:175`](../../frontend/src/screens/SalaDeEspera.tsx#L175)

**Estilo**

- `min-width` (achado da revisão) -- fixa a largura do botão pra não pular entre "Copiar link" e "Copiado!".
  [`SalaDeEspera.css:51`](../../frontend/src/screens/SalaDeEspera.css#L51)

**Testes**

- Cobertura da I/O & Edge-Case Matrix -- cópia bem-sucedida, falha da Clipboard API, cliques repetidos, e o clique duplo sobreposto (achado da revisão).
  [`SalaDeEspera.test.tsx:143`](../../frontend/src/screens/SalaDeEspera.test.tsx#L143)
