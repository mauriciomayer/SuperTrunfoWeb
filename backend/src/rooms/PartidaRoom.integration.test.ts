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

/**
 * Camada de integracao de Room (AD-12) da Story 2.1: cobre a Matrix
 * inteira de `iniciarPartida` -- inicio valido (2 e 3 jogadores, regra de
 * sobra AD-6), rejeicao de nao-host, rejeicao de estado errado, e a
 * visibilidade filtrada por `StateView` (AD-3) que nenhum teste anterior
 * exercitava ainda.
 */
describe("PartidaRoom -- iniciarPartida (Story 2.1)", () => {
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

  it("Matrix: host inicia com 2 jogadores -- 16 Cartas cada, estado vira AguardandoSelecao, jogadorDaVez = host", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");

    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    expect(room.state.jogadorDaVez).toBe(host.sessionId);
    const jogadorHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId);
    const jogadorConvidado = room.state.jogadores.find(
      (jogador) => jogador.sessionId === convidado.sessionId,
    );
    expect(jogadorHost?.quantidadeCartas).toBe(16);
    expect(jogadorConvidado?.quantidadeCartas).toBe(16);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: host inicia com 3 jogadores -- 10 Cartas cada, 2 descartadas (AD-6)", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 3, totalIA: 1 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");

    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    // Todos os 3 assentos (2 humanos + 1 IA) recebem exatamente 10 Cartas
    // -- as 2 descartadas (32 % 3) nunca vao pro Monte de ninguem.
    expect(room.state.jogadores).toHaveLength(3);
    for (const jogador of room.state.jogadores) {
      expect(jogador.quantidadeCartas).toBe(10);
    }

    await host.leave();
    await convidado.leave();
  });

  it("host inicia com 4 jogadores -- 8 Cartas cada, divisao exata sem sobra (AD-6), via pipeline real de Room/StateView", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 1 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
    const convidado2 = await testServer.connectTo(room, { nome: "Carla" });

    host.send("iniciarPartida");

    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    // 3 humanos + 1 IA = 4 assentos, todos com exatamente 8 Cartas (32/4,
    // sem sobra -- so n=3 produz sobra na faixa suportada, AD-6).
    expect(room.state.jogadores).toHaveLength(4);
    for (const jogador of room.state.jogadores) {
      expect(jogador.quantidadeCartas).toBe(8);
    }

    await host.leave();
    await convidado1.leave();
    await convidado2.leave();
  });

  it("trava a Room (lock) assim que a Partida comeca, pra nenhum convidado tardio ficar sem Monte", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    // So 2 dos 4 `totalJogadores` declarados entraram -- `maxClients` (4)
    // ainda nao foi atingido, entao sem o `lock()` explicito a Room
    // continuaria aceitando `joinById` normalmente.
    expect(room.locked).toBe(false);

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    await vi.waitFor(() => {
      expect(room.locked).toBe(true);
    });

    await expect(testServer.connectTo(room, { nome: "Tardio" })).rejects.toThrow(/locked/i);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: host tenta iniciar sozinho (so 1 jogador na sala) -- rejeitado, estado nao muda, nenhum Baralho e criado", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });

    host.send("iniciarPartida");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoJogadores");
    const jogadorHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId);
    expect(jogadorHost?.quantidadeCartas).toBe(0);

    await host.leave();
  });

  it("Matrix: convidado (nao-host) envia iniciarPartida -- estado nao muda, nenhum Baralho e criado", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    convidado.send("iniciarPartida");

    // Sem evento de rede esperado (mensagem ignorada) -- da tempo do loop
    // de eventos processar antes de afirmar que nada mudou, sem sleep fixo.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoJogadores");
    const jogadorHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId);
    expect(jogadorHost?.quantidadeCartas).toBe(0);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: iniciarPartida de novo depois que a Partida ja comecou -- estado nao muda, Baralho nao e recriado", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    const jogadorHostAntes = room.state.jogadores.find(
      (jogador) => jogador.sessionId === host.sessionId,
    );
    const quantidadeAntes = jogadorHostAntes?.quantidadeCartas;

    // Reenvio (ex: clique duplo que escapou do guard do frontend) --
    // precisa ser um no-op completo, sem re-embaralhar/redistribuir.
    host.send("iniciarPartida");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoSelecao");
    const jogadorHostDepois = room.state.jogadores.find(
      (jogador) => jogador.sessionId === host.sessionId,
    );
    expect(jogadorHostDepois?.quantidadeCartas).toBe(quantidadeAntes);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: visibilidade de Monte alheio -- Cliente A nunca recebe o Monte completo (nem o topo) de B no seu room.state local, so a contagem", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });
    // Da tempo do patch de StateView (a distribuicao inteira) propagar pro
    // estado local decodificado de cada cliente antes de inspecionar.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const meuJogadorNoHost = host.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
    );
    const oponenteNoHost = host.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
    );

    // AD-3: o dono ve a propria Carta do topo inteira (nunca o Monte todo).
    expect(meuJogadorNoHost?.monte?.length).toBe(1);
    expect(meuJogadorNoHost?.monte?.[0]?.id).toBeTruthy();
    expect(meuJogadorNoHost?.quantidadeCartas).toBe(16);

    // AD-3: o Monte do oponente nunca aparece no estado local do host --
    // nem o array inteiro (16 Cartas), nem sequer a Carta do topo dele. So
    // a contagem publica (`quantidadeCartas`) e visivel.
    expect(oponenteNoHost?.monte).toBeUndefined();
    expect(oponenteNoHost?.quantidadeCartas).toBe(16);

    // Simetrico do lado do convidado.
    const meuJogadorNoConvidado = convidado.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
    );
    const oponenteNoConvidado = convidado.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
    );
    expect(meuJogadorNoConvidado?.monte?.length).toBe(1);
    expect(oponenteNoConvidado?.monte).toBeUndefined();
    expect(oponenteNoConvidado?.quantidadeCartas).toBe(16);

    await host.leave();
    await convidado.leave();
  });
});
