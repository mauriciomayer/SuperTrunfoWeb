---
title: 'Criar Sala'
type: 'feature'
created: '2026-08-15'
status: 'in-review'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
baseline_commit: '4258dadbe92eb36fa2b35e7d1702c355d68ec1e6'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O jogo hoje só tem o esqueleto da Story 1.1 (conexão de teste, sem tela real). Não existe nenhuma forma de o host efetivamente criar uma Partida.

**Approach:** Construir a tela Criar Sala (host informa nome, total de Jogadores 2-4, quantos são IA) que, ao confirmar, cria uma `PartidaRoom` real via `client.create("partida", { nome, totalJogadores, totalIA })` (AD-2), recebe o `roomId`, e leva o host a uma Sala de Espera mínima mostrando ele mesmo na lista, as vagas de IA já preenchidas (FR-5), e o link de convite. Substitui a página placeholder de conexão de teste da Story 1.1 pelo fluxo real.

## Boundaries & Constraints

**Always:**
- Payload de criação: `{ nome: string, totalJogadores: number, totalIA: number }` (AD-1, tabela atualizada nesta história — ver nota abaixo).
- `PartidaRoom.onCreate` valida `totalJogadores` (inteiro 2-4) e `totalIA` (inteiro, 0 até `totalJogadores - 1`, sempre sobrando ao menos 1 vaga humana pro host) — servidor é a autoridade (AD-1), nunca confia só na validação do formulário.
- `maxClients` da Room = `totalJogadores - totalIA` (só vagas humanas contam pra conexão de rede).
- Vagas de IA declaradas entram no estado (`EstadoPartida.jogadores`) desde a criação, com `isIA: true` (FR-5, Padrões de Estado "IA preenchendo vaga").
- O primeiro Jogador humano a entrar (o próprio host, via auto-join do `create()`) é marcado `isHost: true` — host é sempre o primeiro jogador da Partida (decisão já fechada).
- Visual segue `DESIGN.md`/`EXPERIENCE.md` e os mockups `mockups/key-criar-sala.html` e `mockups/key-sala-espera.html` (identidade pop-art, Botão Primário, Lista da Sala de Espera com pílula IA/humano) — ler os mockups pra estrutura e cores exatas, não reinventar.
- Botão "Criar Sala" desabilitado até nome preenchido (Padrões de Estado).
- Nome de domínio em português nos identificadores de schema/mensagens (`Jogador`, `EstadoPartida`, `criarSala`), técnico genérico em inglês.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução — os pontos em aberto de UX/arquitetura relevantes já foram fechados.

**Never:**
- Fluxo de convidado entrando pela Sala de Espera (Story 1.3) — a Sala de Espera desta história só reflete o estado no momento da criação (host + IA), sem lidar com `entrarSala`.
- Atualização em tempo real da lista quando outros jogadores entram/saem (Story 1.4) — pode renderizar a partir do `room.state` atual, mas não é este story que constrói a UX de "lista crescendo ao vivo" como requisito.
- Botão "Iniciar" funcional (Story 1.4) — não renderizar nem implementar; o mínimo de 2 Jogadores ainda não tem por onde ser validado sem 1.3/1.4.
- Nenhuma lógica de jogo (Baralho, Rodada, Super Trunfo) — Épico 2.
- Roteamento/URL real para convidados abrirem o link (`/sala/:roomId`) — Story 1.3. Nesta história o link é só texto exibido (`origin + "/sala/" + roomId`), sem rota correspondente ainda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Criação válida | nome="Mauricio", totalJogadores=4, totalIA=0 | `PartidaRoom` criada, host na lista como `isHost`, vai pra Sala de Espera com link de convite | N/A |
| Criação com IA | nome="Rafael", totalJogadores=3, totalIA=2 | Sala criada com 2 Jogadores `isIA: true` já na lista, além do host | N/A |
| totalIA inválido | totalJogadores=2, totalIA=2 (sem vaga humana sobrando) | Servidor rejeita a criação | `onCreate` lança erro, `client.create()` rejeita a promise no frontend |
| Nome vazio | nome="" | Botão "Criar Sala" permanece desabilitado | N/A (não chega a enviar) |

</frozen-after-approval>

## Code Map

- `backend/src/schema/Jogador.ts` -- novo, Schema `@colyseus/schema`: `sessionId`, `nome`, `isHost`, `isIA`
- `backend/src/schema/EstadoPartida.ts` -- novo, Schema: `jogadores: ArraySchema<Jogador>`, `totalJogadoresDeclarado`, `totalIADeclarado`
- `backend/src/rooms/PartidaRoom.ts` -- estender `onCreate(options)` (validação + `maxClients` + IA inicial + `setState`) e `onJoin(client, options)` (cria `Jogador` humano, primeiro = host); Room criada na Story 1.1, hoje só loga
- `frontend/src/client/colyseusClient.ts` -- Story 1.1 só tem `conectarNaSalaDeTeste`; adicionar `criarSala(nome, totalJogadores, totalIA)` chamando `client.create("partida", {...})`
- `frontend/src/screens/CriarSala.tsx` -- novo, formulário (nome + steppers), visual conforme `mockups/key-criar-sala.html`
- `frontend/src/screens/SalaDeEspera.tsx` -- novo, mostra link de convite + `ListaSalaEspera`, visual conforme `mockups/key-sala-espera.html`
- `frontend/src/components/ListaSalaEspera.tsx` -- novo, uma linha por Jogador (nome + pílula IA/Você/Entrou) a partir de `room.state.jogadores`
- `frontend/src/App.tsx` -- Story 1.1 só tem a página placeholder de teste de conexão; substituir pelo roteamento simples entre `CriarSala` e `SalaDeEspera` via estado local (sem lib de rotas, fluxo linear)
- `e2e/scaffolding.spec.ts` -- teste da Story 1.1 assume a página placeholder que deixa de existir; substituir pelo fluxo real (preencher formulário → ver Sala de Espera)
- `_bmad-output/planning-artifacts/architecture/architecture-SuperTrunfoWeb-2026-08-15/ARCHITECTURE-SPINE.md` -- **já editado nesta sessão antes desta spec**: tabela de AD-1 completada (payload de `criarSala` estava incompleto, faltava `totalJogadores`/`totalIA` exigidos por FR-5); não precisa de nova alteração, só contexto de por que o Code Map acima já reflete o payload de 3 campos

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/schema/Jogador.ts` + `backend/src/schema/EstadoPartida.ts` -- criar os Schemas -- base de estado sincronizado pra Sala de Espera
- [x] `backend/src/rooms/PartidaRoom.ts` -- `onCreate` valida `totalJogadores`/`totalIA`, seta `maxClients`, popula IA inicial, `setState(new EstadoPartida())`; `onJoin` cria `Jogador` humano (primeiro = host) -- efetiva FR-5 e AD-2 no servidor
- [x] `frontend/src/client/colyseusClient.ts` -- adicionar `criarSala(nome, totalJogadores, totalIA)` -- ponte de rede única pro intent (AD-10)
- [x] `frontend/src/screens/CriarSala.tsx` -- formulário com validação de nome vazio -- primeira tela real do jogo
- [x] `frontend/src/components/ListaSalaEspera.tsx` -- lista reativa ao `room.state.jogadores` -- reusável pela Story 1.4
- [x] `frontend/src/screens/SalaDeEspera.tsx` -- monta link de convite + `ListaSalaEspera` -- destino do host após criar
- [x] `frontend/src/App.tsx` -- troca a página placeholder pelo roteamento local `CriarSala` ↔ `SalaDeEspera` -- fluxo real substitui o scaffolding
- [x] `e2e/scaffolding.spec.ts` -- reescrever pro fluxo real de criação -- cobre a Matrix acima ponta a ponta
- [x] Teste unitário (`backend/src/rooms/` ou `game/`, camada Vitest) cobrindo a validação de `totalIA` inválido -- cobre a linha "totalIA inválido" da Matrix
- [x] Teste de integração de Room (`@colyseus/testing`) cobrindo criação válida com IA -- cobre as linhas "Criação válida"/"Criação com IA" da Matrix sem navegador

**Acceptance Criteria:**
- Given a tela Criar Sala, when informo meu nome, escolho o total de Jogadores (2-4) e quantos são IA, e confirmo, then uma `PartidaRoom` é criada (AD-2) com um `roomId` único
- Given a Sala criada, when chego na Sala de Espera, then recebo um link de convite baseado no `roomId` e vejo a mim mesmo na lista como host
- Given `totalIA` declarado maior que zero, when a Sala é criada, then as vagas de IA já aparecem na lista da Sala de Espera antes de qualquer convidado entrar

## Spec Change Log

## Design Notes

`PartidaRoom.onCreate` roda inteiro antes do auto-join do host disparar `onJoin` -- por isso os Jogadores de IA (empurrados em `onCreate`) já existem no array quando a lógica de "primeiro humano = host" roda em `onJoin`. Não é uma corrida: Colyseus processa isso sequencialmente no mesmo ciclo de criação.

## Verification

**Commands:**
- `cd backend && npm test` -- expected: inclui o novo teste unitário de validação de `totalIA`, tudo verde
- `cd backend && npm run test:integration` -- expected: inclui o novo teste de criação com IA, tudo verde
- `cd frontend && npm test` -- expected: verde (componentes existentes + qualquer novo teste de componente que fizer sentido)
- `npx playwright test` (raiz) -- expected: fluxo real Criar Sala → Sala de Espera passa

**Manual checks (if no CLI):**
- Abrir `frontend` local, criar uma sala com 3 jogadores/1 IA, confirmar visualmente que a Sala de Espera mostra host + pílula IA, e que o link de convite exibido contém o `roomId` real da Room criada.

## Suggested Review Order

**Criação da Sala no servidor (AD-1, AD-2, FR-5)**

- Validação de `totalJogadores`/`totalIA` -- o servidor nunca confia só na UI.
  [`PartidaRoom.ts:24`](../../backend/src/rooms/PartidaRoom.ts#L24)

- `onCreate` seta `maxClients`, popula as vagas de IA e inicializa o estado antes de qualquer join.
  [`PartidaRoom.ts:69`](../../backend/src/rooms/PartidaRoom.ts#L69)

- `onJoin` cria o `Jogador` humano e marca o primeiro como host; agora também rejeita nome vazio no servidor.
  [`PartidaRoom.ts:91`](../../backend/src/rooms/PartidaRoom.ts#L91)

- Schemas sincronizados que sustentam esse estado.
  [`EstadoPartida.ts:11`](../../backend/src/schema/EstadoPartida.ts#L11)
  [`Jogador.ts:11`](../../backend/src/schema/Jogador.ts#L11)

**Fronteira de rede do frontend (AD-10)**

- Único ponto que dispara o intent `criarSala` -- toda a tela conversa com o backend só por aqui.
  [`colyseusClient.ts:22`](../../frontend/src/client/colyseusClient.ts#L22)

**Fluxo de telas**

- Formulário real (nome + steppers), agora dentro de um `<form>` de verdade (Enter funciona).
  [`CriarSala.tsx:19`](../../frontend/src/screens/CriarSala.tsx#L19)

- Roteamento local mínimo entre as duas telas, substituindo a página placeholder da Story 1.1.
  [`App.tsx:13`](../../frontend/src/App.tsx#L13)

- Sala de Espera: link de convite + lista, com o fix de re-render por `onStateChange` (Colyseus muta o mesmo objeto de estado).
  [`SalaDeEspera.tsx:59`](../../frontend/src/screens/SalaDeEspera.tsx#L59)

- Lista reativa reusável pela Story 1.4.
  [`ListaSalaEspera.tsx:25`](../../frontend/src/components/ListaSalaEspera.tsx#L25)

**Pirâmide de testes (AD-12)**

- Unitário: validação de `totalIA`/`totalJogadores` isolada, sem subir Room.
  [`PartidaRoom.test.ts:10`](../../backend/src/rooms/PartidaRoom.test.ts#L10)

- Integração de Room: criação válida, com IA, rejeição de `totalIA` inválido, e `maxClients` barrando conexão extra.
  [`PartidaRoom.integration.test.ts:11`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L11)

- Componente: nome vazio desabilita o botão, e o caminho de rejeição de `criarSala()` mostra erro e reabilita o botão.
  [`CriarSala.test.tsx:24`](../../frontend/src/screens/CriarSala.test.tsx#L24)

- E2E: fluxo real Criar Sala → Sala de Espera ponta a ponta.
  [`criar-sala.spec.ts:11`](../../e2e/criar-sala.spec.ts#L11)
