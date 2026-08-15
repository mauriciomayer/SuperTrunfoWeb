# Super Trunfo Web

Repositório com pacotes independentes -- `backend/` (Node + TypeScript + Colyseus) e `frontend/`
(Vite + React + TypeScript) -- mais os testes E2E na raiz. Não é um monorepo com npm workspaces:
cada pacote tem seu próprio `package.json` e suas próprias dependências, sem import de código de
um para o outro (comunicação só via rede/WebSocket).

## Instalação

Como não há npm workspaces, é preciso instalar dependências separadamente em cada lugar:

```bash
npm install              # raiz (testes E2E)
cd backend && npm install
cd ../frontend && npm install
```

## Rodando em desenvolvimento

Em dois terminais separados:

```bash
cd backend && npm run dev   # sobe o servidor Colyseus
cd frontend && npm run dev  # sobe o app Vite+React
```

## Rodando os testes

```bash
npm test
```

Roda, em sequência, as 4 camadas da pirâmide de testes: unitário (`backend/`, Vitest), componente
(`frontend/`, Vitest + React Testing Library), integração de Room (`backend/`, `@colyseus/testing`)
e E2E (raiz, Playwright, contra frontend+backend reais).

## Nota sobre `overrides` no `backend/package.json`

O `overrides` que redireciona `@colyseus/uwebsockets-transport` para `@colyseus/ws-transport` é um
workaround porque o ambiente de dev não consegue instalar o pacote original (que depende de um
fetch via git) -- não tem efeito funcional, já que o app usa `WebSocketTransport` mesmo.
