import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Server, WebSocketTransport } from "colyseus";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Carta } from "../schema/Carta.ts";
import { PartidaRoom } from "./PartidaRoom.ts";

/**
 * Override controlavel de `embaralhar` (Story 2.2, teste "Super Trunfo no
 * topo"): por padrao (`atual === null`) delega pro `embaralhar` real
 * (Fisher-Yates de verdade, todo o resto da suite continua com
 * distribuicao aleatoria genuina) -- so o teste que precisa forcar uma
 * Carta especifica no topo do Jogador da vez seta `atual` (e reseta em
 * `finally`/`afterEach`). `vi.hoisted` porque o factory de `vi.mock`
 * abaixo roda antes de qualquer import (inclusive deste modulo), entao
 * precisa de uma referencia que sobreviva a esse hoisting.
 */
const embaralharOverride = vi.hoisted(() => ({
  atual: null as ((cartas: Carta[]) => Carta[]) | null,
}));

vi.mock("../game/baralho.ts", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("../game/baralho.ts")>();
  return {
    ...original,
    embaralhar: (cartas: Carta[]) =>
      embaralharOverride.atual ? embaralharOverride.atual(cartas) : original.embaralhar(cartas),
  };
});

// Reseta o override depois de CADA teste do arquivo (nao so do teste que o
// seta) -- rede de seguranca extra alem do `finally` local, pro caso de um
// teste falhar no meio e deixar o override vazando pros seguintes.
afterEach(() => {
  embaralharOverride.atual = null;
});

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

    expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
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

/**
 * Camada de integracao de Room (AD-12) da Story 2.2: cobre a Matrix
 * inteira de `jogarCarta` -- selecao valida (com verificacao de que TODOS
 * os clientes recebem a Carta do topo de TODOS depois da selecao, nao so
 * a propria), rejeicao de nao-e-a-vez, rejeicao de estado errado,
 * rejeicao de atributo invalido/ausente.
 */
describe("PartidaRoom -- jogarCarta (Story 2.2)", () => {
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

  /**
   * Sobe uma sala de 2 jogadores humanos e leva ate `AguardandoSelecao`
   * (mesmo fluxo do describe anterior) -- base comum de toda a Matrix de
   * `jogarCarta` abaixo.
   */
  async function criarPartidaEmAguardandoSelecao() {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });
    // Da tempo do StateView da distribuicao propagar antes de qualquer
    // asserção que dependa do estado local decodificado de cada cliente.
    await new Promise((resolve) => setTimeout(resolve, 150));

    return { room, host, convidado };
  }

  it("Matrix: selecao valida -- rodadaAtual preenchido, TODOS os clientes recebem a Carta do topo de TODOS, estado vira Revelando", async () => {
    const { room, host, convidado } = await criarPartidaEmAguardandoSelecao();

    host.send("jogarCarta", { atributo: "velocidadeMaxima" });

    await vi.waitFor(() => {
      expect(room.state.estado).toBe("Revelando");
    });

    expect(room.state.rodadaAtual.atributoSelecionado).toBe("velocidadeMaxima");
    expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2);

    // Da tempo do patch de StateView (a revelacao) propagar pro estado
    // local decodificado de cada cliente antes de inspecionar.
    await new Promise((resolve) => setTimeout(resolve, 150));

    // AD-3/Story 2.2: a revelacao concede a Carta do topo de TODOS os
    // Jogadores ativos pra TODO Client -- nao so a propria. Verifica dos
    // dois lados (host e convidado), inclusive do oponente.
    const meuNoHost = host.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
    );
    const oponenteNoHost = host.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
    );
    expect(meuNoHost?.monte?.length).toBe(1);
    expect(oponenteNoHost?.monte?.length).toBe(1);
    expect(oponenteNoHost?.monte?.[0]?.id).toBeTruthy();

    const meuNoConvidado = convidado.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
    );
    const oponenteNoConvidado = convidado.state.jogadores.find(
      (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
    );
    expect(meuNoConvidado?.monte?.length).toBe(1);
    expect(oponenteNoConvidado?.monte?.length).toBe(1);
    expect(oponenteNoConvidado?.monte?.[0]?.id).toBeTruthy();

    // `rodadaAtual.atributoSelecionado` (campo plano, sem `@view()`) tem
    // que propagar pro estado local decodificado de AMBOS os clientes, nao
    // so no `room.state` do proprio servidor -- mesma classe de bug
    // (instancia de Schema compartilhada corrompendo a arvore de
    // encoding) que esta Story ja encontrou e corrigiu uma vez
    // (`clonarCarta`); sem essa checagem, uma regressao de propagacao
    // desse campo especifico passaria batido por toda a suite.
    expect(
      (host.state.rodadaAtual as { atributoSelecionado: string }).atributoSelecionado,
    ).toBe("velocidadeMaxima");
    expect(
      (convidado.state.rodadaAtual as { atributoSelecionado: string }).atributoSelecionado,
    ).toBe("velocidadeMaxima");

    // `rodadaAtual.cartasEmDisputa` E marcada `@view()` (mesmo padrao de
    // `Jogador.monte`) -- invisivel por padrao pra qualquer Client ate
    // alguem conceder visibilidade explicitamente, e nenhuma Story ainda
    // faz essa concessao pra este campo especifico (so `monte[0]` e
    // concedido, ja coberto acima). Trava esse comportamento
    // padrao-seguro: mesmo com o servidor preenchendo `cartasEmDisputa`
    // no proprio `room.state` (linha 416), nenhum cliente deveria
    // decodificar conteudo nenhum aqui.
    expect(
      (host.state.rodadaAtual as { cartasEmDisputa?: unknown[] }).cartasEmDisputa,
    ).toBeUndefined();
    expect(
      (convidado.state.rodadaAtual as { cartasEmDisputa?: unknown[] }).cartasEmDisputa,
    ).toBeUndefined();

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: quem nao e o Jogador da vez envia jogarCarta -- nada muda, sem crash", async () => {
    const { room, host, convidado } = await criarPartidaEmAguardandoSelecao();
    expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

    convidado.send("jogarCarta", { atributo: "velocidadeMaxima" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoSelecao");
    expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
    expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: jogarCarta fora de AguardandoSelecao (ex: clique duplo durante Revelando) -- nada muda, sem crash", async () => {
    const { room, host, convidado } = await criarPartidaEmAguardandoSelecao();

    host.send("jogarCarta", { atributo: "velocidadeMaxima" });
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("Revelando");
    });

    const atributoAntes = room.state.rodadaAtual.atributoSelecionado;
    const totalCartasAntes = room.state.rodadaAtual.cartasEmDisputa.length;

    // Reenvio (clique duplo que escapou do guard do frontend) -- precisa
    // ser um no-op completo, sem duplicar Cartas em `cartasEmDisputa`.
    host.send("jogarCarta", { atributo: "potenciaCv" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("Revelando");
    expect(room.state.rodadaAtual.atributoSelecionado).toBe(atributoAntes);
    expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(totalCartasAntes);

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: atributo invalido (chave que nao existe em atributos.ts) -- rejeitado, nada muda", async () => {
    const { room, host, convidado } = await criarPartidaEmAguardandoSelecao();

    host.send("jogarCarta", { atributo: "potenciaDoMotorInventada" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoSelecao");
    expect(room.state.rodadaAtual.atributoSelecionado).toBe("");

    await host.leave();
    await convidado.leave();
  });

  it("Matrix: atributo ausente (jogarCarta({})) -- rejeitado, nada muda (obrigatorio nesta historia)", async () => {
    const { room, host, convidado } = await criarPartidaEmAguardandoSelecao();

    host.send("jogarCarta", {});
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.estado).toBe("AguardandoSelecao");
    expect(room.state.rodadaAtual.atributoSelecionado).toBe("");

    await host.leave();
    await convidado.leave();
  });

  it("Boundaries 'Never': atributo continua obrigatorio mesmo quando a Carta do topo do Jogador da vez e a Super Trunfo (2A) -- excecao da letra 'A' e vitoria automatica so na Story 2.4", async () => {
    // Forca a 2A (unica Super Trunfo do Baralho) pro inicio do array
    // embaralhado -- `distribuir` faz round-robin a partir do indice 0, e
    // `jogadores[0]` e sempre o host (primeiro humano a entrar), entao
    // `baralhoEmbaralhado[0]` vira exatamente `hostMonte[0]` (o topo).
    embaralharOverride.atual = (cartas) => {
      const superTrunfo = cartas.find((carta) => carta.superTrunfo);
      const resto = cartas.filter((carta) => !carta.superTrunfo);
      return superTrunfo ? [superTrunfo, ...resto] : cartas;
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Confirma a premissa do teste antes de testar o comportamento: o
      // topo do Monte do Jogador da vez (host) e' de fato a Super Trunfo.
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      expect(jogadorHost?.monte[0]?.id).toBe("2A");
      expect(jogadorHost?.monte[0]?.superTrunfo).toBe(true);

      // `jogarCarta({})` -- sem `atributo` -- precisa ser rejeitado do
      // mesmo jeito que seria com qualquer outra Carta (Boundaries
      // "Never": excecao do Super Trunfo, atributo opcional, e Story 2.4;
      // esta historia nao da tratamento especial nenhum a essa Carta).
      host.send("jogarCarta", {});
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.estado).toBe("AguardandoSelecao");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");

      // Com `atributo` valido, a mesma selecao e aceita normalmente --
      // prova que a rejeicao acima foi por falta de `atributo`
      // especificamente, nao por algum outro efeito colateral da 2A estar
      // no topo.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("velocidadeMaxima");

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  });
});
