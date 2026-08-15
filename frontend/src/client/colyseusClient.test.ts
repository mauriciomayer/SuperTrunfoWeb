import { describe, expect, it, vi } from "vitest";
import type { Room } from "@colyseus/sdk";
import { iniciarPartida } from "./colyseusClient.ts";

/**
 * Camada unitária (AD-12) de `colyseusClient.ts` -- Story 1.4.
 *
 * `SalaDeEspera.test.tsx` mocka o módulo inteiro de `colyseusClient.ts`
 * (`vi.mock`), então o corpo real de `iniciarPartida` nunca roda em nenhum
 * outro teste da suíte -- sem este arquivo, um typo no nome do intent (ex.:
 * `"iniciaPartida"`) passaria despercebido.
 */
describe("iniciarPartida", () => {
  it("chama room.send('iniciarPartida') -- intent AD-1, fire-and-forget", () => {
    const room = { send: vi.fn() } as unknown as Room;

    iniciarPartida(room);

    expect(room.send).toHaveBeenCalledWith("iniciarPartida");
  });
});
