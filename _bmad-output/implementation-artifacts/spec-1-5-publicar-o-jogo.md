---
title: 'Publicar o Jogo'
type: 'chore'
created: '2026-08-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
baseline_commit: '2e0f10921501da7db503ec55b4215a1cc0939b3b'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O jogo só roda localmente. Não há como mandar um link real pra família/amigos fora de casa.

**Approach:** Preparar o código pra rodar como um único serviço em produção (Render, escolhido pelo usuário) — o backend passa a servir o build estático do frontend pelo mesmo processo/origem (AD-11), usando o Express que o `WebSocketTransport` do Colyseus já expõe (`getExpressApp()`), sem precisar de uma dependência nova nem de CORS. Adicionar scripts de build/start na raiz pra virarem os comandos de Build/Start do Render, e escrever um guia (`DEPLOY.md`) com os passos exatos. O deploy em si (criar conta, configurar o serviço, publicar) é manual — o usuário escolheu conduzir isso ele mesmo com o guia, não eu.

## Boundaries & Constraints

**Always:**
- Quando `frontend/dist` existe (build de produção), o backend serve os arquivos estáticos e um fallback de SPA (qualquer rota não reclamada pelo Colyseus devolve `index.html` — o roteamento por `window.location.pathname` já existente no frontend cuida do resto) pelo Express já exposto por `transport.getExpressApp()` — sem adicionar `express` como import direto sem ele já estar disponível via essa API do Colyseus.
- Quando `frontend/dist` não existe (dev local), o comportamento atual não muda nada: backend e frontend continuam rodando como dois processos separados (`npm run dev` em cada um), exatamente como hoje.
- `frontend/src/client/colyseusClient.ts`: se `VITE_BACKEND_URL` estiver definido, ele sempre vence (escape hatch). Em dev (`import.meta.env.DEV`), mantém o fallback atual `ws://localhost:2567`. Em build de produção sem override, deriva a URL do próprio `window.location` (`wss://` se `https:`, senão `ws://`, mesmo host) — mesma origem lógica, sem precisar configurar nada no Render pro frontend.
- `package.json` (raiz) ganha `build` (instala e builda `backend/` e `frontend/`) e `start` (roda o backend buildado) — pra virarem, literalmente, os campos Build Command / Start Command do Render.
- `DEPLOY.md` novo na raiz: passo a passo do Render (criar conta, Web Service, valores exatos de Build/Start Command, nota de que é preciso dar `git push` pro GitHub antes porque o Render puxa de lá) — sem inventar CI/CD, staging, ou domínio customizado (AD-11: um único ambiente de produção).
- Backend continua lendo a porta de `process.env.PORT` (já é assim desde a Story 1.1) — o Render define isso sozinho.

**Ask First:**
- Se `WebSocketTransport.getExpressApp()` não existir ou não se comportar como documentado nos tipos instalados (`@colyseus/ws-transport`), parar e perguntar antes de inventar um jeito alternativo de servir os estáticos.

**Never:**
- Criar a conta no Render, configurar o serviço, ou publicar de fato — isso é manual, o usuário faz sozinho seguindo o `DEPLOY.md`. Este story não termina com um link real no ar.
- CORS — o design de mesma origem evita precisar disso.
- Staging, CI/CD, domínio customizado — fora de escopo (AD-11, proporcional a hobby).
- Novo teste E2E/Playwright automatizado pro caminho de servir estático em produção — verificação é manual (ver Verification), pra não investir em infraestrutura de teste desproporcional a uma checagem pontual de configuração de deploy.
- Mudar qualquer lógica de jogo, Room, ou schema — este story é só sobre como o processo é servido/publicado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Produção local (smoke) | `frontend/dist` existe, backend buildado rodando | Requisição HTTP em `/` devolve o `index.html` do frontend | N/A |
| Dev local (inalterado) | `frontend/dist` não existe | Backend não tenta servir estático nenhum; `npm run dev` nos dois pacotes continua igual | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/index.ts` -- hoje só sobe o `Server`/`WebSocketTransport`; adicionar `transport.getExpressApp()` + `express.static`/fallback condicionados à existência de `frontend/dist` (checar `fs.existsSync`), registrados depois que o `Server` já inicializou (pra não sombrear as rotas HTTP internas do Colyseus)
- `backend/src/servirFrontendEstatico.ts` (novo, pós patch pass) -- a lógica acima extraída de `index.ts` pra virar testável em isolamento; gate de ativação é `NODE_ENV === "production"` + `existsSync`
- `backend/src/servirFrontendEstatico.integration.test.ts` (novo, pós patch pass) -- prova o mecanismo real subindo `WebSocketTransport`/`Server` de verdade
- `backend/package.json` -- adicionar `express` como dependência direta (hoje só transitiva via `@colyseus/ws-transport`, que já a expõe tipada em `getExpressApp()`)
- `frontend/src/client/colyseusClient.ts` -- hoje `BACKEND_URL` só olha `VITE_BACKEND_URL` ou hardcode de dev; adicionar a derivação por `window.location` pro caso de produção sem override
- `package.json` (raiz) -- hoje só tem scripts de teste; adicionar `build` e `start`
- `DEPLOY.md` (novo, raiz) -- guia manual do Render

## Tasks & Acceptance

**Execution:**
- [x] `backend/package.json` -- adicionar `express` (versão já resolvida transitivamente, pra consistência) como dependência direta
- [x] `backend/src/index.ts` -- servir `frontend/dist` (estático + fallback SPA) via `transport.getExpressApp()`, só quando a pasta existir -- efetiva a linha "Produção local (smoke)" da Matrix, preservando a linha "Dev local (inalterado)"
- [x] `frontend/src/client/colyseusClient.ts` -- derivar `BACKEND_URL` de `window.location` em produção sem `VITE_BACKEND_URL` explícito
- [x] `package.json` (raiz) -- scripts `build` (instala+builda os dois pacotes) e `start` (sobe o backend buildado)
- [x] `DEPLOY.md` (novo) -- passo a passo Render: criar conta, Web Service conectado ao repo (nota: precisa `git push` antes), valores de Build/Start Command (`npm run build` / `npm start`, ou equivalentes que os scripts acima produzem), variáveis de ambiente (nenhuma obrigatória além do que o Render já define sozinho), e o teste final ("peça pra alguém fora da sua rede abrir o link e criar uma sala")

**Acceptance Criteria:**
- Given o backend e o frontend prontos localmente, when os dois são buildados e o backend buildado é iniciado localmente, then uma requisição HTTP na raiz devolve o `index.html` do frontend pelo mesmo processo/porta que também aceita conexão Colyseus
- Given o `DEPLOY.md`, when o usuário segue os passos no Render, then o backend roda como processo Node de longa duração (nunca serverless — AD-11) num host que sustenta WebSocket persistente, e o frontend fica publicado na mesma origem lógica
- Given um link de sala criado em produção (depois do deploy manual do usuário), when um convidado fora da rede local abre esse link, then ele consegue entrar na Sala de Espera de ponta a ponta -- **este critério é verificado manualmente pelo usuário após o deploy, fora do escopo automatizável desta implementação**

## Spec Change Log

**Patch pass (revisão de diff, todos os pontos classificados como "patch" -- sem renegociação de intent):**
1. `backend/src/servirFrontendEstatico.ts` (novo) -- `servirFrontendEstaticoSeExistir` extraída de `index.ts` pra virar testável em isolamento (sem disparar os efeitos colaterais de módulo do entrypoint real: porta fixa, `process.exit` em erro).
2. `backend/src/servirFrontendEstatico.integration.test.ts` (novo) -- sobe `WebSocketTransport`/`Server` de verdade e bate com `fetch` real, provando o mecanismo descrito nas Design Notes: `GET /` devolve o `index.html` do fixture quando a função roda antes de `.listen()`, devolve o banner padrão do Colyseus quando nada reivindica `/` antes de `.listen()`, e o fallback de SPA/rotas internas do Colyseus (`/__healthcheck`) coexistem sem um engolir o outro. Fecha o gap: nenhum outro teste do repo tocava esse caminho.
3. `servirFrontendEstatico.ts` -- `res.sendFile(...)` ganhou callback de erro (log + `500` se os headers ainda não foram enviados) -- antes, uma falha nessa chamada caía no handler de erro padrão do Express sem nenhum log nosso.
4. `servirFrontendEstatico.ts` -- fallback de SPA trocou `app.use((_req, res) => ...)` por `app.get(/.*/, (_req, res) => ...)` -- antes interceptava qualquer método HTTP (POST/PUT/DELETE) pra qualquer rota não reconhecida devolvendo 200+HTML; agora é restrito a navegação (GET/HEAD).
5. `servirFrontendEstatico.ts` -- ativação ganhou um gate extra `NODE_ENV === "production"` (além do `existsSync` já existente); se `NODE_ENV=production` mas `frontend/dist` não existir, loga aviso em vez de retornar em silêncio. Sem isso, `npm run dev` no backend depois de um build local do frontend (`frontend/dist` sobrando no disco) passaria a servir esse build antigo sem querer, contrariando o Boundaries ("dev local... comportamento atual não muda nada").
6. `backend/src/index.ts` -- mensagem de sucesso do `.listen()` não afirma mais "localhost" incondicionalmente (`[backend] servidor Colyseus rodando na porta ${PORT}`) -- em produção o processo não roda em localhost, e é essa string que o `DEPLOY.md` pede pro usuário procurar no log como confirmação do deploy.
7. `package.json` (raiz) -- script `build` trocou `npm install` por `npm ci` (nos dois pacotes) -- garante instalação exatamente igual ao lockfile em todo build de produção no Render.
8. `backend/package.json`, `frontend/package.json`, `package.json` (raiz) -- `"engines": { "node": ">=24" }` -- consistente com o Node 24 LTS já decidido na arquitetura; nada impedia o Render de rodar numa versão diferente da testada.
9. `DEPLOY.md` -- corrigida a ordem de log descrita no passo 6 (`servindo frontend estatico` aparece antes de `servidor Colyseus rodando`, não depois); adicionada nota sobre auto-deploy do Render ligado por padrão a cada `git push`; adicionada sugestão de Health Check Path (`/__healthcheck`, já embutido no roteador do Colyseus); adicionada nota de que `NODE_ENV=production` já vem definido pelo Render em runtime (confirmado na documentação oficial do Render) -- é esse valor que agora ativa o item 5 acima, então nada extra precisa ser configurado.

## Design Notes

`transport.getExpressApp()` só existe depois que `new Server({ transport: new WebSocketTransport() })` termina de montar o transporte -- por isso o código de servir estático precisa vir depois dessa construção, nunca antes. Registrar o `express.static`/fallback SPA *depois* da inicialização do `Server` também importa: garante que as rotas HTTP internas do Colyseus (matchmake) já estão registradas no mesmo app Express antes do nosso fallback "pega tudo que sobrar" existir, evitando que ele intercepte requisições que deveriam ir pro Colyseus.

O SPA fallback não precisa de nenhuma lib de rotas: o frontend já decide sozinho, no cliente, entre `CriarSala`/`EntrarSala`/`SalaDeEspera` a partir de `window.location.pathname` (Story 1.3) -- o servidor só precisa devolver o mesmo `index.html` pra qualquer caminho que não seja do Colyseus, e o roteamento local do `App.tsx` cuida do resto.

## Verification

**Commands:**
- `cd backend && npm run build && cd ../frontend && npm run build` -- expected: os dois buildam sem erro
- `cd backend && npm test && npm run test:integration` -- expected: verde, nada quebrou (este story não mexe em Room/schema)
- `cd frontend && npm test` -- expected: verde

**Manual checks (if no CLI):**
- Depois de buildar os dois pacotes, rodar o backend buildado localmente (`node backend/dist/index.js` ou `npm start` na raiz) e abrir `http://localhost:<porta>` no navegador -- confirmar que a tela Criar Sala aparece (prova que o estático está sendo servido) e que dá pra criar uma sala de verdade (prova que o Colyseus continua funcionando no mesmo processo/porta).
- Depois do deploy real no Render (manual, seguindo `DEPLOY.md`): pedir pra alguém em outra rede abrir o link publicado e confirmar que consegue criar/entrar numa sala. Este é o critério de aceite final da história e só pode ser confirmado pelo usuário após o deploy.

## Suggested Review Order

**Mecanismo de servir o frontend (o coração da história)**

- Ativação (`NODE_ENV=production` + `existsSync`), registro do estático e do fallback de SPA -- e por que a ordem de chamada é a parte que mais importa.
  [`servirFrontendEstatico.ts:50`](../../backend/src/servirFrontendEstatico.ts#L50)

- Chamada no ponto exato: depois do `Server` montar o transporte, antes de `.listen()`.
  [`index.ts:15`](../../backend/src/index.ts#L15)

- Prova real do mecanismo e da ordem -- inclui o caso "e se alguém mover a chamada pra depois do `.listen()`" de propósito.
  [`servirFrontendEstatico.integration.test.ts:30`](../../backend/src/servirFrontendEstatico.integration.test.ts#L30)

**Frontend em produção sem configuração**

- Deriva a URL do backend a partir da própria origem quando não há override -- é o que permite zero variável de ambiente no Render pro frontend.
  [`colyseusClient.ts:23`](../../frontend/src/client/colyseusClient.ts#L23)

- Cobertura dos três ramos (override, dev, produção http/https).
  [`colyseusClient.test.ts:27`](../../frontend/src/client/colyseusClient.test.ts#L27)

**Scripts e guia**

- `build`/`start` da raiz -- viram literalmente os campos do Render.
  [`package.json:12`](../../package.json#L12)

- Passo a passo do deploy manual, incluindo os ajustes da revisão (ordem de log, auto-deploy, health check).
  [`DEPLOY.md:1`](../../DEPLOY.md#L1)
