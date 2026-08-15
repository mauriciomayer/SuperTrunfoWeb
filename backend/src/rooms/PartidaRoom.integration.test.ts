import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Server, WebSocketTransport } from "colyseus";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { PartidaRoom } from "./PartidaRoom.ts";

/**
 * Camada de integracao de Room (AD-12): exercita a `PartidaRoom` inteira
 * via `@colyseus/testing`, sem navegador. Cobre as linhas "Criacao
 * valida"/"Criacao com IA"/"totalIA invalido" da Matrix da Story 1.2.
 */
describe("PartidaRoom -- integracao", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    const server = new Server({
      transport: new WebSocketTransport(),
    });
    server.define("partida", PartidaRoom);
    testServer = await boot(server);
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("cria sala valida e marca o host (auto-join do create) na lista de jogadores", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
    const client = await testServer.connectTo(room, { nome: "Mauricio" });

    expect(room.roomId).toBeDefined();
    expect(room.state.jogadores.length).toBe(1);

    const host = room.state.jogadores[0];
    expect(host.nome).toBe("Mauricio");
    expect(host.isHost).toBe(true);
    expect(host.isIA).toBe(false);
    expect(host.sessionId).toBe(client.sessionId);

    await client.leave();
  });

  it("cria sala com IA declarada -- vagas de IA ja entram no estado antes de qualquer join", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 3, totalIA: 2 });

    // As 2 vagas de IA ja existem no estado assim que a sala e criada (FR-5),
    // antes de qualquer cliente (nem o host) ter entrado.
    expect(room.state.jogadores.length).toBe(2);
    expect(room.state.jogadores.every((jogador) => jogador.isIA)).toBe(true);
    expect(room.maxClients).toBe(1); // totalJogadores(3) - totalIA(2) = 1 vaga humana

    const client = await testServer.connectTo(room, { nome: "Rafael" });

    expect(room.state.jogadores.length).toBe(3);
    const host = room.state.jogadores.find((jogador) => !jogador.isIA);
    expect(host?.nome).toBe("Rafael");
    expect(host?.isHost).toBe(true);

    await client.leave();
  });

  it("rejeita totalIA sem vaga humana sobrando pro host (Matrix: totalJogadores=2, totalIA=2)", async () => {
    await expect(
      testServer.createRoom("partida", { totalJogadores: 2, totalIA: 2 }),
    ).rejects.toBeTruthy();
  });

  it("maxClients = totalJogadores - totalIA barra uma terceira conexao alem das vagas humanas", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    expect(room.maxClients).toBe(2);

    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    expect(room.clients.length).toBe(2);
    // Alem de rejeitar, confere o texto da mensagem: e exatamente "locked"
    // que `EntrarSala.tsx` (Story 1.3, frontend) usa pra decidir mostrar
    // "Esta sala já está cheia." pro convidado -- sem essa asserção, uma
    // mudança de texto na lib do Colyseus quebraria esse mapeamento sem
    // nenhum teste acusar.
    await expect(testServer.connectTo(room, { nome: "Terceiro" })).rejects.toThrow(/locked/i);

    await host.leave();
    await convidado.leave();
  });

  it("onLeave remove o Jogador que saiu de state.jogadores, mantendo so quem fica (Story 1.4)", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    expect(room.state.jogadores.length).toBe(2);

    await convidado.leave();
    // `onLeave` roda assincronamente no servidor -- faz polling da condicao
    // esperada em vez de um sleep fixo (um sleep fixo fica flaky sob carga,
    // mesmo problema ja visto nos testes E2E multi-contexto).
    await vi.waitFor(() => {
      expect(room.state.jogadores.length).toBe(1);
    });
    expect(room.state.jogadores[0].sessionId).toBe(host.sessionId);
    expect(room.state.jogadores[0].nome).toBe("Mauricio");

    await host.leave();
  });

  it("onLeave remove so quem sai quando alguem do meio da lista sai, preservando os demais (Story 1.4)", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
    const primeiro = await testServer.connectTo(room, { nome: "Mauricio" });
    const doMeio = await testServer.connectTo(room, { nome: "Rafael" });
    const ultimo = await testServer.connectTo(room, { nome: "Carla" });

    expect(room.state.jogadores.length).toBe(3);

    // Quem sai nao e o primeiro (host) nem o ultimo a entrar -- o
    // `findIndex`/`splice` por indice se comporta diferente removendo do
    // meio do array do que so sobrando 1 elemento.
    await doMeio.leave();
    await vi.waitFor(() => {
      expect(room.state.jogadores.length).toBe(2);
    });

    const sessionIdsRestantes = room.state.jogadores.map((jogador) => jogador.sessionId);
    expect(sessionIdsRestantes).toEqual([primeiro.sessionId, ultimo.sessionId]);
    expect(sessionIdsRestantes).not.toContain(doMeio.sessionId);

    const host = room.state.jogadores.find((jogador) => jogador.sessionId === primeiro.sessionId);
    expect(host?.nome).toBe("Mauricio");
    expect(host?.isHost).toBe(true);
    const terceiro = room.state.jogadores.find((jogador) => jogador.sessionId === ultimo.sessionId);
    expect(terceiro?.nome).toBe("Carla");

    await primeiro.leave();
    await ultimo.leave();
  });
});
