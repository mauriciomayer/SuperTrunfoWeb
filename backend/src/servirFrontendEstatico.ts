import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { WebSocketTransport } from "colyseus";

/**
 * Resolve o caminho padrao de `frontend/dist`, relativo a este arquivo --
 * dois niveis acima da pasta onde ele mora (`backend/src` em dev,
 * `backend/dist` depois do build) chega na raiz do repo.
 */
function resolverFrontendDistPadrao(): string {
  const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(diretorioAtual, "../../frontend/dist");
}

export interface OpcoesFrontendEstatico {
  /** Override do caminho de `frontend/dist` -- usado pelo teste de integracao (fixture temporario). */
  frontendDist?: string;
  /** Override de `process.env.NODE_ENV` -- usado pelo teste de integracao. */
  nodeEnv?: string;
}

/**
 * Serve o build de producao do frontend (`frontend/dist`) pelo mesmo
 * processo/porta que ja aceita conexao Colyseus (Story 1.5, AD-11) --
 * `transport.getExpressApp()` e o Express que o `WebSocketTransport` ja
 * expoe, sem precisar de CORS nem dependencia nova alem do `express` (ja
 * transitivo via `@colyseus/ws-transport`).
 *
 * Precisa rodar depois que o `Server` termina de montar o transporte (so ai
 * `transport.getExpressApp()` existe) e ANTES de `gameServer.listen()`: e
 * `.listen()` que decide, olhando pro app Express nesse exato instante, se
 * registra a propria rota "/" (texto puro "Colyseus x.y.z") por cima da
 * nossa -- so nao registra se o Express ja tiver alguma rota em "/". Se essa
 * chamada for movida pra depois do `.listen()`, o app Express nem existe
 * ainda no momento em que o Colyseus decide isso, entao o "/" do Colyseus
 * vence pra sempre nessa instancia -- chamar a funcao depois nao resolve.
 * `servirFrontendEstatico.integration.test.ts` prova esse mecanismo subindo
 * um servidor de verdade.
 *
 * So ativa quando `NODE_ENV=production` E `frontend/dist` existe. O gate de
 * `NODE_ENV` (alem do `existsSync`) evita que `npm run dev` sirva sem
 * querer um `frontend/dist` que sobrou no disco de um build local anterior
 * -- o Boundaries do spec da Story 1.5 exige que o dev local continue
 * identico. Se `NODE_ENV=production` mas a pasta nao existir, avisa no log
 * (provavel esquecimento do build do frontend antes do deploy) em vez de
 * falhar em silencio.
 */
export function servirFrontendEstaticoSeExistir(
  transport: WebSocketTransport,
  opcoes: OpcoesFrontendEstatico = {},
): void {
  const producao = (opcoes.nodeEnv ?? process.env.NODE_ENV) === "production";

  if (!producao) {
    return;
  }

  const frontendDist = opcoes.frontendDist ?? resolverFrontendDistPadrao();

  if (!existsSync(frontendDist)) {
    console.warn(
      `[backend] NODE_ENV=production mas ${frontendDist} nao existe -- build do frontend rodou?`,
    );
    return;
  }

  const app = transport.getExpressApp();
  app.use(express.static(frontendDist));

  // Fallback de SPA: qualquer GET/HEAD que sobrar (nao reclamado pelo
  // Colyseus nem por um arquivo estatico) devolve o mesmo `index.html` -- o
  // roteamento por `window.location.pathname` no frontend (Story 1.3) cuida
  // do resto. Restrito a rotas de navegacao (`app.get`, nao `app.use`) pra
  // nao interceptar POST/PUT/DELETE de rotas nao reconhecidas com um
  // 200+HTML enganoso. Regex `/.*/ ` em vez de string (`"/*splat"`) pra nao
  // depender da sintaxe de wildcard nomeado que o Express 5 exige em rotas
  // de string.
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"), (erro) => {
      if (erro) {
        console.error("[backend] falha ao servir index.html:", erro);
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    });
  });

  console.log(`[backend] servindo frontend estatico de ${frontendDist}`);
}
