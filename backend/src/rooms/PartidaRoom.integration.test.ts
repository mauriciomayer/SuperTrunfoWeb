import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server, WebSocketTransport } from "colyseus";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { PartidaRoom } from "./PartidaRoom.ts";

/**
 * Camada de integracao de Room (AD-12): exercita a PartidaRoom inteira via
 * `@colyseus/testing`, sem navegador. Nesta historia a Room ainda nao tem
 * regra de jogo -- so precisa provar que um client consegue entrar.
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

  it("aceita um client entrando na sala", async () => {
    const room = await testServer.createRoom("partida", {});
    const client = await testServer.connectTo(room);

    expect(client.sessionId).toBeDefined();
    expect(room.clients.length).toBe(1);

    await client.leave();
  });
});
