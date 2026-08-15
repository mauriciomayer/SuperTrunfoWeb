---
title: 'Scaffolding do Projeto'
type: 'feature'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'ba9b02a90312232ac654d70ec6b1426bb6dcc2f9'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório hoje só tem documentação e artefatos de planejamento — não existe nenhum código de `frontend/` ou `backend/`, então nenhuma história seguinte do Épico 1 (Criar Sala, Entrar na Sala, Sala de Espera, Publicar o Jogo) tem onde rodar.

**Approach:** Criar `frontend/` (Vite + React 19 + TypeScript) e `backend/` (Node 24 + TypeScript + Colyseus 0.17.x) como pacotes independentes na raiz do repo, sem import de código de um para o outro (AD-10) — só comunicação via rede (WebSocket/`@colyseus/sdk`). Subir um servidor Colyseus mínimo (uma Room vazia) e um frontend que abre uma conexão de teste com ele. Montar a pirâmide de testes de 4 camadas (AD-12) com um teste trivial passando em cada uma, servindo de exemplo pras próximas histórias.

## Boundaries & Constraints

**Always:**
- `frontend/` e `backend/` são pacotes npm separados, cada um com seu próprio `package.json`; zero import de código-fonte de um para o outro.
- Backend usa Node 24 LTS + TypeScript + Colyseus ~0.17.x (server) + `@colyseus/sdk` ~0.17.x (client, nunca o pacote descontinuado `colyseus.js`).
- Frontend usa Vite + React 19 + TypeScript.
- Estrutura de pastas segue o Structural Seed da arquitetura: `backend/src/{rooms,game,schema}/`, `frontend/src/{components,screens,client}/`.
- Pirâmide de testes (AD-12), uma camada de cada vez, tecnologia chata: `Vitest` em `backend/` (unitário) e em `frontend/` (componente, com `React Testing Library`); `@colyseus/testing` em `backend/` (integração de Room); `Playwright` na raiz do repo (E2E). Um teste trivial por camada, todos verdes.
- Este é um projeto hobby — escopo proporcional: sem CI/CD, sem Docker, sem infraestrutura de produção nesta história (isso é Story 1.5, Publicar o Jogo).

**Ask First:**
- Se alguma versão pinada (Node 24, Colyseus 0.17.x, React 19, Vite) não estiver disponível ou gerar conflito real de dependências ao instalar, parar e perguntar antes de trocar de versão.

**Never:**
- Nenhuma lógica de jogo (regras, comparação de atributos, IA) — isso é Épico 2 e 3.
- Nenhuma tela real (Criar Sala, Entrar na Sala etc.) — isso é o resto do Épico 1. Aqui é só o esqueleto + uma conexão de teste.
- Nenhum deploy real — isso é Story 1.5.
- Nenhum `.env`/segredo real — só a estrutura de config local (`.env.example` se necessário).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Conexão de teste | `backend/` rodando localmente numa porta fixa | `frontend/` conecta via `@colyseus/sdk` e entra numa Room mínima com sucesso | Se a conexão falhar, o teste correspondente falha com erro claro |
| `npm test` em cada camada | Cada pacote/raiz com seu framework de teste configurado | Um teste trivial passa em cada uma das 4 camadas (unitário backend, componente frontend, integração de Room, E2E) | Teste que falhar bloqueia a história — não fica verde por acidente |

</frozen-after-approval>

## Code Map

- `backend/` -- pacote novo (Node+TS+Colyseus); não existe ainda, criar do zero
- `backend/src/index.ts` -- entrypoint do servidor Colyseus
- `backend/src/rooms/` -- Rooms do Colyseus (nesta história: uma Room mínima só para validar a conexão)
- `backend/src/game/` -- lógica pura de jogo (vazio nesta história, criado como placeholder para o Épico 2 e para o teste unitário trivial)
- `backend/src/schema/` -- Schemas de estado do Colyseus (vazio/mínimo nesta história)
- `frontend/` -- pacote novo (Vite+React+TS); não existe ainda, criar via `npm create vite@latest`
- `frontend/src/client/` -- wrapper do `@colyseus/sdk` (conexão com o backend)
- `frontend/src/components/` -- componentes React (vazio nesta história, placeholder para o teste de componente trivial)
- `frontend/src/screens/` -- telas (vazio nesta história)
- `docs/carros_specs.csv` -- fonte de dados do deck (32 carros); não é copiado para dentro de `backend/` nesta história, só referenciado — ingestão real é de história futura do Épico 2
- `.gitignore` -- não existe ainda no repo; criar cobrindo `node_modules/`, `dist/`, `build/`, `.env`, artefatos de teste (Playwright report, coverage)
- `playwright.config.ts` -- novo, na raiz do repo (E2E roda contra frontend+backend reais)

## Tasks & Acceptance

**Execution:**
- [x] `.gitignore` -- criar na raiz cobrindo `node_modules/`, `dist/`, `build/`, `.env`, relatórios de teste -- evita commitar lixo de build/dependências
- [x] `backend/package.json` + `backend/tsconfig.json` -- criar pacote Node+TS+Colyseus (`colyseus`, `@colyseus/schema`, dependências de dev TS) -- fundação do servidor
- [x] `backend/src/index.ts` + `backend/src/rooms/PartidaRoom.ts` (mínima, sem lógica de jogo ainda) -- subir servidor Colyseus local numa porta fixa com uma Room que aceita join -- prova de vida do backend, base para a Story 1.2 estender depois
- [x] `frontend/` -- gerar via `npm create vite@latest frontend -- --template react-ts`, ajustar para o padrão de pastas do projeto (`src/components`, `src/screens`, `src/client`) -- fundação do cliente
- [x] `frontend/src/client/colyseusClient.ts` -- instanciar `@colyseus/sdk` `Client` apontando pro backend local e expor uma função de conexão de teste -- prova de que os dois pacotes conversam só por rede (AD-10)
- [x] `backend/vitest.config.ts` + `backend/src/game/exemplo.test.ts` (teste trivial) -- montar Vitest unitário no backend -- primeira camada da pirâmide (AD-12)
- [x] `frontend/vitest.config.ts` + `frontend/src/components/Exemplo.test.tsx` (teste trivial com React Testing Library) -- montar Vitest componente no frontend -- segunda camada
- [x] `backend/src/rooms/PartidaRoom.integration.test.ts` -- teste de integração de Room com `@colyseus/testing`, validando que um client consegue entrar na Room -- terceira camada, sem navegador
- [x] `playwright.config.ts` + `e2e/scaffolding.spec.ts` (teste trivial: sobe frontend+backend, abre página, confirma conexão) -- montar Playwright na raiz -- quarta camada, ponta a ponta real
- [x] `package.json` (raiz, se necessário) ou scripts documentados -- garantir que `npm test` (ou equivalente por pacote) roda as 4 camadas -- comando único de verificação pra próximas histórias

**Acceptance Criteria:**
- Given um repositório vazio de código, when o scaffolding é executado, then existem as pastas `frontend/` e `backend/` com `package.json` próprios, sem import de código de um para o outro (AD-10)
- Given `frontend/` e `backend/` scaffolded, when cada um é iniciado localmente (`npm run dev` ou equivalente), then `backend/` sobe um servidor Colyseus mínimo e `frontend/` roda um app Vite+React+TS, ambos localmente
- Given os dois rodando localmente, when o frontend tenta conectar, then ele abre uma conexão WebSocket de teste com o backend via `@colyseus/sdk` com sucesso
- Given o scaffolding de `frontend/` e `backend/` concluído, when a pirâmide de testes é montada (AD-12), then `Vitest` roda em `backend/` (unitário) e em `frontend/` (componente, com `React Testing Library`), `@colyseus/testing` está configurado em `backend/` (integração de Room), e `Playwright` está configurado na raiz (E2E)
- Given as quatro camadas de teste configuradas, when os testes são executados, then um teste trivial de cada camada passa, servindo de exemplo pras próximas histórias

## Spec Change Log

## Verification

**Commands:**
- `cd backend && npm test` -- expected: teste unitário trivial passa
- `cd frontend && npm test` -- expected: teste de componente trivial passa (Vitest + React Testing Library)
- `cd backend && npm run test:integration` (ou equivalente) -- expected: teste de integração de Room via `@colyseus/testing` passa
- `npx playwright test` (raiz) -- expected: teste E2E trivial passa contra frontend+backend rodando de verdade
- `cd backend && npm run dev` / `cd frontend && npm run dev` -- expected: ambos sobem sem erro, frontend conecta ao backend

## Suggested Review Order

**Fronteira de rede frontend/backend (AD-10)**

- Entrypoint do backend: sobe o servidor Colyseus e registra a Room de teste.
  [`index.ts:6`](../../backend/src/index.ts#L6)

- Único ponto de conexão do frontend com o backend -- toda comunicação passa por aqui, nunca por import direto.
  [`colyseusClient.ts:11`](../../frontend/src/client/colyseusClient.ts#L11)

- Room mínima que aceita a conexão de teste; ainda sem regra de jogo (Épico 2).
  [`PartidaRoom.ts:11`](../../backend/src/rooms/PartidaRoom.ts#L11)

**Ciclo de vida da conexão no frontend**

- Efeito que abre a conexão de teste e trata os três estados (conectando/conectado/erro), incluindo o caso de desmontar antes de resolver.
  [`App.tsx:17`](../../frontend/src/App.tsx#L17)

**Pirâmide de testes (AD-12)**

- Camada unitária: função pura trivial de `src/game/`, primeira camada da pirâmide.
  [`exemplo.test.ts:1`](../../backend/src/game/exemplo.test.ts#L1)

- Camada de integração de Room via `@colyseus/testing`, sem navegador.
  [`PartidaRoom.integration.test.ts:1`](../../backend/src/rooms/PartidaRoom.integration.test.ts#L1)

- Camada de componente: Vitest + React Testing Library isolando um componente.
  [`Exemplo.test.tsx:1`](../../frontend/src/components/Exemplo.test.tsx#L1)

- Camada E2E: sobe frontend+backend reais via Playwright e confirma a conexão ponta a ponta.
  [`scaffolding.spec.ts:1`](../../e2e/scaffolding.spec.ts#L1)

- Orquestra as 4 camadas com um único comando (`npm test` na raiz).
  [`package.json:11`](../../package.json#L11)

**Periféricos**

- Config raiz do Playwright, incluindo o `webServer` que sobe os dois pacotes.
  [`playwright.config.ts:1`](../../playwright.config.ts#L1)

- Cobertura do que fica de fora do controle de versão.
  [`.gitignore:1`](../../.gitignore#L1)

- Guia de onboarding: como instalar e rodar os pacotes separados.
  [`README.md:1`](../../README.md#L1)
