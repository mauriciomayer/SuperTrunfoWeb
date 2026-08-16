import { describe, expect, it, vi } from "vitest";
import type { Room } from "@colyseus/sdk";
import { iniciarPartida, jogarCarta, resolverBackendUrl } from "./colyseusClient.ts";

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

/**
 * `jogarCarta` (Story 2.2, AD-1): mesma razao de existir do describe
 * acima -- `Carta.test.tsx`/`MesaDeJogo.test.tsx` nunca chamam o
 * `colyseusClient.ts` real (mockado), entao um typo no nome do intent ou
 * no formato do payload (ex.: mandar `atributo` fora de um objeto) so
 * seria pego aqui.
 */
describe("jogarCarta", () => {
  it("chama room.send('jogarCarta', { atributo }) -- intent AD-1, fire-and-forget", () => {
    const room = { send: vi.fn() } as unknown as Room;

    jogarCarta(room, "velocidadeMaxima");

    expect(room.send).toHaveBeenCalledWith("jogarCarta", { atributo: "velocidadeMaxima" });
  });

  it("Story 2.4: chama room.send('jogarCarta', { atributo: undefined }) quando nenhum atributo e passado (jogada de Super Trunfo)", () => {
    const room = { send: vi.fn() } as unknown as Room;

    jogarCarta(room);

    expect(room.send).toHaveBeenCalledWith("jogarCarta", { atributo: undefined });
  });
});

/**
 * `resolverBackendUrl` (Story 1.5, AD-11): mesma origem em producao, sem
 * exigir configuracao no Render pro frontend.
 */
describe("resolverBackendUrl", () => {
  const localhost = { protocol: "http:", host: "localhost:3000" };

  it("VITE_BACKEND_URL explicito sempre vence, mesmo em dev", () => {
    const url = resolverBackendUrl(
      { VITE_BACKEND_URL: "ws://exemplo.com", DEV: true },
      localhost,
    );

    expect(url).toBe("ws://exemplo.com");
  });

  it("VITE_BACKEND_URL explicito sempre vence, mesmo em producao", () => {
    const url = resolverBackendUrl(
      { VITE_BACKEND_URL: "ws://exemplo.com", DEV: false },
      { protocol: "https:", host: "jogo.onrender.com" },
    );

    expect(url).toBe("ws://exemplo.com");
  });

  it("em dev sem override, cai no fallback ws://localhost:2567", () => {
    const url = resolverBackendUrl({ DEV: true }, localhost);

    expect(url).toBe("ws://localhost:2567");
  });

  it("em producao sem override e sem https, deriva ws:// do mesmo host", () => {
    const url = resolverBackendUrl(
      { DEV: false },
      { protocol: "http:", host: "jogo.onrender.com" },
    );

    expect(url).toBe("ws://jogo.onrender.com");
  });

  it("em producao sem override e com https, deriva wss:// do mesmo host", () => {
    const url = resolverBackendUrl(
      { DEV: false },
      { protocol: "https:", host: "jogo.onrender.com" },
    );

    expect(url).toBe("wss://jogo.onrender.com");
  });
});
