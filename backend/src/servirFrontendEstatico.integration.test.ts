import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { Server, WebSocketTransport } from "colyseus";
import { servirFrontendEstaticoSeExistir } from "./servirFrontendEstatico.ts";

const MARCADOR_FIXTURE = "MARCADOR-FIXTURE-SPA-STORY-1-5";

/**
 * Camada de integracao (AD-12) do mecanismo real que serve `frontend/dist`
 * em producao (Story 1.5, AD-11). Sobe um `WebSocketTransport`/`Server` de
 * verdade (sem `@colyseus/testing`: `boot()` usa uma porta fixa que
 * colidiria com `PartidaRoom.integration.test.ts` rodando em paralelo) e
 * bate com HTTP real (`fetch`), provando o que as Design Notes descrevem:
 * `transport.getExpressApp()` so existe depois que o `Server` monta o
 * transporte, e o app Express precisa ja estar registrado *antes* de
 * `gameServer.listen()` -- e' o `.listen()` que decide, examinando o app
 * Express nesse exato instante, se registra a propria rota "/" (banner de
 * texto "Colyseus x.y.z") por cima da nossa.
 *
 * Sem este arquivo, nenhum teste do repo cobria esse caminho: o de
 * integracao de Room (`PartidaRoom.integration.test.ts`) nunca toca
 * `backend/src/index.ts`/`servirFrontendEstatico.ts`, e o E2E roda contra
 * `npm run dev`, onde `frontend/dist` nem existe -- um refactor que movesse
 * a chamada de `servirFrontendEstaticoSeExistir` pra depois do `.listen()`
 * (parece uma limpeza razoavel) passaria sem nenhum teste acusar.
 */
describe("servirFrontendEstaticoSeExistir -- integracao", () => {
  let frontendDist: string;

  beforeEach(() => {
    frontendDist = mkdtempSync(path.join(tmpdir(), "super-trunfo-frontend-dist-"));
    writeFileSync(
      path.join(frontendDist, "index.html"),
      `<!doctype html><html><body>${MARCADOR_FIXTURE}</body></html>`,
    );
  });

  afterEach(() => {
    rmSync(frontendDist, { recursive: true, force: true });
  });

  async function subirServidor() {
    const transport = new WebSocketTransport();
    const gameServer = new Server({ transport });

    await gameServer.listen(0); // porta 0 = a SO escolhe uma porta livre

    const porta = (transport.server!.address() as AddressInfo).port;
    return { gameServer, transport, porta };
  }

  it("GET / devolve o index.html do fixture quando a funcao roda antes de .listen() -- mesma ordem do codigo real", async () => {
    const transport = new WebSocketTransport();
    const gameServer = new Server({ transport });

    // Mesma ordem de backend/src/index.ts: registrar o estatico ANTES de
    // `.listen()`.
    servirFrontendEstaticoSeExistir(transport, { frontendDist, nodeEnv: "production" });

    await gameServer.listen(0);
    const porta = (transport.server!.address() as AddressInfo).port;

    try {
      const respostaRaiz = await fetch(`http://localhost:${porta}/`);
      const corpoRaiz = await respostaRaiz.text();

      expect(respostaRaiz.status).toBe(200);
      expect(corpoRaiz).toContain(MARCADOR_FIXTURE);
      expect(corpoRaiz).not.toContain("Colyseus");

      // Fallback de SPA: uma rota que so existe no roteamento do lado do
      // cliente (Story 1.3, `window.location.pathname`) tambem devolve o
      // mesmo `index.html`, nao um 404.
      const respostaRotaCliente = await fetch(`http://localhost:${porta}/sala/abc123`);
      const corpoRotaCliente = await respostaRotaCliente.text();

      expect(respostaRotaCliente.status).toBe(200);
      expect(corpoRotaCliente).toContain(MARCADOR_FIXTURE);

      // As rotas internas do Colyseus continuam respondendo normalmente --
      // o fallback "pega tudo que sobrar" nao as engoliu.
      const respostaHealthcheck = await fetch(`http://localhost:${porta}/__healthcheck`);
      expect(respostaHealthcheck.status).toBe(200);
      expect(await respostaHealthcheck.text()).toBe("OK");
    } finally {
      await gameServer.gracefullyShutdown(false);
    }
  });

  it("GET / devolve o banner padrao do Colyseus (nao o SPA) quando nada reivindica '/' antes de .listen() -- prova por que a ordem importa", async () => {
    // Nao chama `servirFrontendEstaticoSeExistir` antes do `.listen()` --
    // simula exatamente o efeito de mover essa chamada pra depois (o app
    // Express so e' examinado por `gameServer.listen()` no instante em que
    // ele roda; nao existir ainda nesse instante e o que a chamada tardia
    // teria em comum com nunca chamar).
    const { gameServer, porta } = await subirServidor();

    try {
      const resposta = await fetch(`http://localhost:${porta}/`);
      const corpo = await resposta.text();

      expect(resposta.status).toBe(200);
      expect(corpo).not.toContain(MARCADOR_FIXTURE);
      expect(corpo).toContain("Colyseus");
    } finally {
      await gameServer.gracefullyShutdown(false);
    }
  });

  it("nao registra nada quando NODE_ENV nao e 'production', mesmo com frontend/dist existindo (Boundaries: dev local inalterado)", async () => {
    const transport = new WebSocketTransport();
    const gameServer = new Server({ transport });

    servirFrontendEstaticoSeExistir(transport, { frontendDist, nodeEnv: "development" });

    await gameServer.listen(0);
    const porta = (transport.server!.address() as AddressInfo).port;

    try {
      const resposta = await fetch(`http://localhost:${porta}/`);
      const corpo = await resposta.text();

      expect(corpo).not.toContain(MARCADOR_FIXTURE);
      expect(corpo).toContain("Colyseus");
    } finally {
      await gameServer.gracefullyShutdown(false);
    }
  });
});
