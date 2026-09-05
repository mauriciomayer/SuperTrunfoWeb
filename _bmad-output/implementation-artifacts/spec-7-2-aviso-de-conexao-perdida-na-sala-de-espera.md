---
title: 'Aviso de Conexão Perdida na Sala de Espera (Story 7.2)'
type: 'feature'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '23ac47f8bc8dfc83b8ea5c31a0f61caf7f689924'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `SalaDeEspera.tsx` nunca trata `room.onLeave`/`room.onError` (callbacks do `@colyseus/sdk`, do lado do CLIENTE) — se a própria conexão do Jogador cair de vez (reconexão automática do SDK esgotada, ou um erro real), a tela continua mostrando o último estado conhecido, congelada, sem nenhum aviso. Foi exatamente essa lacuna que fez o host, no incidente real investigado na Story 7.1, achar que "funcionou bem do meu lado" quando na verdade sua própria conexão já tinha caído — ele nunca soube que precisava recriar a sala.

**Approach:** Assinar `room.onLeave`/`room.onError` (client-side) em `SalaDeEspera.tsx`; quando qualquer um disparar, substituir a tela inteira por um aviso claro (mesmo padrão visual `msg-box` já usado em `EntrarSala.tsx` pro estado de erro), com o texto orientando a ação certa pro papel do Jogador (host recria a sala; convidado reabre o link).

## Boundaries & Constraints

**Always:**
- O aviso só aparece quando `onLeave`/`onError` (client-side) dispara de verdade — nunca durante a janela de reconexão automática do SDK (que já roda por padrão, sem nenhum código novo aqui) nem durante o `onDrop` (client-side) inicial de uma queda que ainda pode se resolver sozinha.
- O texto do aviso é diferente pro host (orienta recriar a sala) e pro convidado (orienta reabrir o link de convite) — a mesma tela já distingue os dois papéis hoje (`souHost`), reusar esse mesmo dado.
- Título do aviso com `role="alert"`, mesmo padrão de acessibilidade já usado em `EntrarSala.tsx`.
- Nenhuma mudança no backend (`PartidaRoom.ts`) — a Story 7.1 já cobre o lado do servidor por inteiro.
- Os listeners (`onLeave`/`onError`) são removidos no cleanup do efeito, mesmo padrão já usado pro listener de `onStateChange` existente.

**Ask First:** nenhuma decisão identificada até agora que exija aprovação humana antes de prosseguir.

**Never:**
- Nunca usar `onDrop` (client-side) pra mostrar um estado intermediário de "reconectando" — fora do escopo desta história (AC pede o aviso só quando a conexão cai de vez, não durante uma tentativa em andamento); registrar como melhoria futura possível, não implementar agora.
- Nunca tentar reconectar manualmente (`client.reconnect(...)`) — o SDK já faz isso sozinho por padrão; esta história só trata o caminho de FALHA definitiva.
- Nunca alterar `room.onStateChange` nem qualquer outra lógica já existente do componente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Conexão do host cai de vez | `room.onLeave` dispara (reconexão automática esgotada) | Tela inteira vira aviso: título de alerta + orientação pra recriar a sala | N/A |
| Conexão do convidado cai de vez | `room.onLeave` dispara (reconexão automática esgotada) | Tela inteira vira aviso: título de alerta + orientação pra reabrir o link | N/A |
| Erro de conexão | `room.onError` dispara | Mesmo aviso do `onLeave` (texto genérico o suficiente pra cobrir os dois) | N/A |
| Reconexão automática em andamento (SDK) | `room.onDrop` dispara, retry ainda não esgotou | Tela continua normal, sem nenhum aviso — a reconexão pode ainda ter sucesso | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/SalaDeEspera.tsx` -- novo `useState<boolean>` (ex.: `conexaoPerdida`); novo `useEffect` (perto do de `onStateChange`, linha ~95-105) assinando `room.onLeave`/`room.onError` (ambos existem como signals `((cb) => EventEmitter) & { remove, once, ... }` no `@colyseus/sdk`, `Room.d.ts` linhas 83-96) -- ambos setam `conexaoPerdida = true`; cleanup remove os dois via `.remove(callback)`, mesmo padrão do listener de `onStateChange` já existente (linha 100-104).
- `frontend/src/screens/SalaDeEspera.tsx` -- quando `conexaoPerdida` for `true`, renderizar o aviso ANTES do `if (totalDeclarado === 0 || jogadores.length === 0)` de "Carregando" (linha ~121) -- a conexão caída tem prioridade sobre qualquer outro estado de render. Texto usa `souHost` (já calculado mais abaixo no componente hoje, linha ~166 -- vai precisar subir o cálculo de `meuJogador`/`souHost` pra ANTES desse novo early-return, já que hoje só é calculado depois do guard de "Carregando").
- `frontend/src/screens/SalaDeEspera.css` -- novo bloco `.sala-de-espera .msg-box`/`.msg-box-titulo`/`.msg-box-subtitulo`, copiando o bloco equivalente já existente em `EntrarSala.css` (linhas 78-101) -- mesma duplicação deliberada já aceita no projeto entre telas diferentes (ex.: `.chip-resultado__texto` duplicado em `FimDePartida.css`), nunca um novo componente/CSS compartilhado.
- `@colyseus/sdk` (node_modules, `Room.d.ts` linhas 83-110) -- SOMENTE LEITURA, evidência já coletada: `onLeave`/`onError`/`onDrop`/`onReconnect` são signals client-side independentes dos hooks de mesmo nome no SERVIDOR (Story 7.1) -- via `Room.mjs` linhas 71-89, 318-339: uma queda reconectável dispara `onDrop` imediatamente e entra no retry automático (habilitado por padrão); só dispara `onLeave` quando os retries esgotam, o uptime da sala é curto demais pra tentar, ou é uma queda não-reconectável -- exatamente o sinal certo pra esta história (nunca durante uma tentativa em andamento).
- `frontend/src/screens/EntrarSala.tsx`/`.css` -- referência de padrão visual (`msg-box`), somente leitura, não modificar.
- `frontend/src/screens/SalaDeEspera.test.tsx` -- `criarRoomFalso` (linha ~31) precisa ganhar `onLeave`/`onError` como signals fake (`Object.assign(vi.fn(), { remove: vi.fn() })`, mesmo padrão de `onStateChange` já usado ali) pros novos testes conseguirem disparar `vi.mocked(room.onLeave).mock.calls[0][0](code, reason)`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/SalaDeEspera.tsx` -- subir o cálculo de `meuJogador`/`souHost` pra antes do guard de "Carregando", adicionar `conexaoPerdida` (state) + `useEffect` assinando `onLeave`/`onError` com cleanup.
- [x] `frontend/src/screens/SalaDeEspera.tsx` -- novo early-return de aviso (antes do guard de "Carregando") quando `conexaoPerdida` for `true`, com texto condicionado a `souHost`.
- [x] `frontend/src/screens/SalaDeEspera.css` -- novo bloco `.msg-box`/`.msg-box-titulo`/`.msg-box-subtitulo` (copiado de `EntrarSala.css`).
- [x] `frontend/src/screens/SalaDeEspera.test.tsx` -- `criarRoomFalso` ganha `onLeave`/`onError` fake; novos testes: (a) `onLeave` disparado mostra o aviso certo pro host; (b) `onLeave` disparado mostra o aviso certo pro convidado; (c) `onError` disparado também mostra o aviso; (d) sem nenhum disparo, a tela continua normal (regressão).
- [x] `frontend/src/screens/SalaDeEspera.tsx` -- log de observabilidade (`console.error`) com `code`/`reason` no callback compartilhado (achado da revisão).
- [x] `frontend/src/screens/SalaDeEspera.test.tsx` -- teste provando que `conexaoPerdida` tem prioridade sobre o guard de "Carregando" (achado da revisão); teste de cleanup dos listeners no unmount; asserção de que a UI normal desaparece por completo quando o aviso aparece.

**Acceptance Criteria:**
- Given estou na Sala de Espera como host, when minha conexão cai de vez (`onLeave`), then a tela mostra um aviso claro com `role="alert"` orientando recriar a sala (FR-37).
- Given estou na Sala de Espera como convidado, when minha conexão cai de vez (`onLeave`), then a tela mostra um aviso claro orientando reabrir o link de convite (FR-37).
- Given minha conexão sofre um erro (`onError`), then o mesmo aviso aparece.
- Given a reconexão automática do SDK ainda está tentando (`onDrop` disparou, sem `onLeave`/`onError` ainda), then a tela continua mostrando o estado normal da Sala de Espera, sem nenhum aviso.

## Spec Change Log

**Revisão (patches, sem achado de escopo/intent):** blind-hunter + edge-case-hunter + verification-gap revisaram o diff. verification-gap encontrou um gap real: nenhum teste provava que `conexaoPerdida` realmente tem prioridade sobre o guard de "Carregando" (a razão inteira de ter subido `meuJogador`/`souHost`) -- corrigido com um teste usando `jogadores` vazio. blind-hunter encontrou falta de log de observabilidade (corrigido) e coverage assimétrico de cleanup/UI-desaparece (corrigido com 2 testes/asserções novas). 5 achados de baixo risco registrados em `deferred-work.md` em vez de corrigidos: a corrida estreita de `souHost` cair pro texto errado se `onLeave`/`onError` disparar antes do primeiro snapshot de estado (2 revisores independentes, mas exigiria expandir escopo pra `App.tsx`); uma corrida ainda mais estreita de montagem; `onError` nunca resetar `conexaoPerdida` pra um erro hipotético não-fatal; uma futura funcionalidade de "sair da sala" (inexistente hoje) disparando este mesmo aviso; e a falta de um estado intermediário "reconectando..." (já antecipada nas Design Notes originais). Vários outros achados foram rejeitados por corresponderem ao precedente já estabelecido em `EntrarSala.tsx` (role="alert" só no título, sem gestão de foco, sem link clicável, CSS com valores literais, tom de voz "pra"/"pro") -- não são desvios introduzidos por esta história.

## Design Notes

O `@colyseus/sdk` já reconecta automaticamente por padrão (`reconnection.enabled: true`, confirmado na Story 7.1) -- por isso esta história NUNCA precisa chamar `client.reconnect(...)` nem gerenciar retry algum; só precisa reagir ao sinal de que os retries automáticos JÁ acabaram (`onLeave`) ou que algo deu errado de forma mais direta (`onError`). Uma melhoria futura possível (fora de escopo aqui, ver Boundaries "Never") seria usar `onDrop` pra mostrar um "reconectando…" enquanto o SDK tenta sozinho, em vez de deixar a tela simplesmente parada durante essa janela -- mas o AC desta história só pede o aviso quando a conexão cai DE VEZ, não durante uma tentativa.

## Verification

**Commands:**
- `cd frontend && npx vitest run SalaDeEspera` -- expected: todos os testes passam, incluindo os novos de `onLeave`/`onError`, sem regressão nos testes já existentes.

## Suggested Review Order

**Mecanismo: assinatura de onLeave/onError e prioridade do aviso**

- Entrada principal -- assina os 2 signals client-side do SDK, loga o motivo, e marca `conexaoPerdida` (achado da revisão: o log).
  [`SalaDeEspera.tsx:118`](../../frontend/src/screens/SalaDeEspera.tsx#L118)

- `meuJogador`/`souHost` subiram pra antes do guard de "Carregando" -- por quê o aviso precisa vir antes de qualquer outro estado.
  [`SalaDeEspera.tsx:152`](../../frontend/src/screens/SalaDeEspera.tsx#L152)

- O early-return do aviso em si -- texto condicionado ao papel (`souHost`), mesmo padrão visual `msg-box` de `EntrarSala.tsx`.
  [`SalaDeEspera.tsx:160`](../../frontend/src/screens/SalaDeEspera.tsx#L160)

**CSS -- duplicação deliberada do padrão visual**

- Bloco `.msg-box`/`.msg-box-titulo`/`.msg-box-subtitulo`, copiado de `EntrarSala.css` (nunca um componente compartilhado).
  [`SalaDeEspera.css:99`](../../frontend/src/screens/SalaDeEspera.css#L99)

**Testes -- Matrix original**

- `onLeave` mostra o aviso certo pro host.
  [`SalaDeEspera.test.tsx:343`](../../frontend/src/screens/SalaDeEspera.test.tsx#L343)

- `onLeave` mostra o aviso certo pro convidado.
  [`SalaDeEspera.test.tsx:371`](../../frontend/src/screens/SalaDeEspera.test.tsx#L371)

- `onError` mostra o mesmo aviso.
  [`SalaDeEspera.test.tsx:397`](../../frontend/src/screens/SalaDeEspera.test.tsx#L397)

**Testes -- achados da revisão**

- Prova a prioridade sobre "Carregando" com `jogadores` vazio -- o gap real que verification-gap encontrou.
  [`SalaDeEspera.test.tsx:432`](../../frontend/src/screens/SalaDeEspera.test.tsx#L432)

- Cleanup dos listeners no unmount.
  [`SalaDeEspera.test.tsx:458`](../../frontend/src/screens/SalaDeEspera.test.tsx#L458)

- `deferred-work.md` (últimas 5 entradas) -- os achados de baixo risco documentados em vez de corrigidos.
