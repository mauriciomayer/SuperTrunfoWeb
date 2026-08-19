import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Server, WebSocketTransport } from "colyseus";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { ArraySchema } from "@colyseus/schema";
import type { Carta } from "../schema/Carta.ts";
import { ATRIBUTOS } from "../game/atributos.ts";
import { DURACAO_REVELACAO_MS, PartidaRoom } from "./PartidaRoom.ts";

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

/**
 * Spy de `decidirAtributoIA` (Story 3.1) -- ao contrario do
 * `embaralharOverride` acima, este NUNCA substitui o comportamento real
 * (sempre delega pra implementacao verdadeira, `Math.random` incluso) --
 * so registra CADA chamada, pra a Matrix de IA conseguir afirmar
 * positivamente "decidirAtributoIA foi chamada" (jogada automatica normal)
 * ou "decidirAtributoIA NAO foi chamada" (Carta do topo da IA e a Super
 * Trunfo, Boundaries "Always" do spec: "decidirAtributoIA nem e chamada").
 * `vi.hoisted` pelo mesmo motivo do `embaralharOverride`.
 */
const decidirAtributoIASpy = vi.hoisted(() => vi.fn());

vi.mock("../game/ia.ts", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("../game/ia.ts")>();
  return {
    ...original,
    decidirAtributoIA: (...args: Parameters<typeof original.decidirAtributoIA>) => {
      decidirAtributoIASpy(...args);
      return original.decidirAtributoIA(...args);
    },
  };
});

// Reseta o override/spy depois de CADA teste do arquivo (nao so do teste
// que os seta) -- rede de seguranca extra alem do `finally` local, pro
// caso de um teste falhar no meio e deixar o override vazando pros
// seguintes.
afterEach(() => {
  embaralharOverride.atual = null;
  decidirAtributoIASpy.mockClear();
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

  it("Story 2.4: atributo vira opcional/ignorado quando a Carta do topo do Jogador da vez e a Super Trunfo (6D) -- transiciona pra SuperTrunfoAcionado, nunca Revelando", async () => {
    // Forca a 6D (unica Super Trunfo do Baralho) pro inicio do array
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
      expect(jogadorHost?.monte[0]?.id).toBe("6D");
      expect(jogadorHost?.monte[0]?.superTrunfo).toBe(true);

      // `jogarCarta({})` -- sem `atributo` -- e aceita normalmente (Story
      // 2.4, AD-1: atributo vira opcional/ignorado pra Super Trunfo) e vai
      // direto pra "SuperTrunfoAcionado", nunca "Revelando" (Boundaries
      // "Always").
      host.send("jogarCarta", {});
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(host.sessionId);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  });
});

/**
 * Camada de integracao de Room (AD-12) da Story 2.4: cobre a Matrix inteira
 * do Super Trunfo -- sem oposicao (vitoria automatica), anulado por Carta
 * "A" de um oponente, e `atributo` ignorado quando enviado junto. Mesmo
 * truque de `embaralharOverride`/`forcarTopos` ja usado nos describes
 * anteriores pra ter um resultado deterministico.
 */
describe("PartidaRoom -- Super Trunfo (Story 2.4)", () => {
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
   * Forca as 2 Cartas dadas pro topo do Monte de host/convidado
   * respectivamente -- mesmo helper do describe de `resolverRodada`
   * (Story 2.3) acima.
   */
  function forcarTopos(idHost: string, idConvidado: string) {
    return (cartas: Carta[]) => {
      const cartaHost = cartas.find((carta) => carta.id === idHost)!;
      const cartaConvidado = cartas.find((carta) => carta.id === idConvidado)!;
      const resto = cartas.filter((carta) => carta.id !== idHost && carta.id !== idConvidado);
      return [cartaHost, cartaConvidado, ...resto];
    };
  }

  it("Matrix: Super Trunfo sem oposicao -- o proprio Jogador do Super Trunfo vence automaticamente, sem comparacao de Atributo, tipoVitoria=superTrunfo", async () => {
    // 6D (Super Trunfo, host) x 2B (letra B, convidado -- nenhuma Carta
    // "A" em jogo, sem oposicao possivel).
    embaralharOverride.atual = forcarTopos("6D", "2B");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", {});
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(host.sessionId);

      // Visibilidade concedida a TODOS durante "SuperTrunfoAcionado" --
      // mesmo padrao de "Revelando" (Story 2.2): cada Client ve a Carta do
      // topo de TODO Jogador ativo, verificado via estado decodificado de
      // cliente real (nao so `room.state` do servidor).
      await new Promise((resolve) => setTimeout(resolve, 150));
      const oponenteNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      expect(oponenteNoHost?.monte?.[0]?.id).toBe("2B");
      const meuNoConvidado = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      expect(meuNoConvidado?.monte?.[0]?.id).toBe("2B");
      const oponenteNoConvidado = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      expect(oponenteNoConvidado?.monte?.[0]?.id).toBe("6D");

      // A pausa de revelacao e' real (`DURACAO_REVELACAO_MS`) -- aguarda o
      // timer do servidor de verdade.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor: o proprio host (Jogador do Super Trunfo), sem oposicao.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe("");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

      expect(room.state.ultimoResultado.vencedorNome).toBe("Mauricio");
      expect(room.state.ultimoResultado.tipoVitoria).toBe("superTrunfo");
      expect(room.state.ultimoResultado.atributo).toBe("");

      // Host jogou 1 Carta (16 -> 15) e coletou as 2 Cartas jogadas
      // (propria Super Trunfo + a do convidado) no fundo do proprio Monte
      // (15 + 2 = 17); convidado so perdeu a sua (15).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(17);
      expect(jogadorConvidado?.quantidadeCartas).toBe(15);
      expect(jogadorHost?.monte.slice(-2).map((carta) => carta.id)).toEqual(["6D", "2B"]);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: Super Trunfo anulado -- o oponente com Carta 'A' vence, coletando o Super Trunfo e as demais Cartas, tipoVitoria=cartaA", async () => {
    // 6D (Super Trunfo, host) x 1A (letra A, convidado -- anula o Super Trunfo).
    embaralharOverride.atual = forcarTopos("6D", "1A");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", {});
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });

      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor: o CONVIDADO (Carta "A"), nao quem jogou o Super Trunfo.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidado.sessionId);
      expect(room.state.ultimoResultado.vencedorNome).toBe("Rafael");
      expect(room.state.ultimoResultado.tipoVitoria).toBe("cartaA");
      expect(room.state.ultimoResultado.atributo).toBe("");

      // Convidado jogou 1 Carta (16 -> 15) e coletou as 2 Cartas jogadas
      // (a Super Trunfo do host + a propria "A") no fundo do proprio Monte
      // (15 + 2 = 17); host so perdeu a sua (15).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(15);
      expect(jogadorConvidado?.quantidadeCartas).toBe(17);
      expect(jogadorConvidado?.monte.slice(-2).map((carta) => carta.id)).toEqual(["6D", "1A"]);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: atributo enviado junto com Super Trunfo e ignorado -- resolve como Super Trunfo normalmente (sem oposicao)", async () => {
    embaralharOverride.atual = forcarTopos("6D", "2B");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Manda um `atributo` valido JUNTO com a Super Trunfo -- precisa ser
      // ignorado por completo (Matrix do spec).
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });
      // Ignorado desde a aceitacao: `atributoSelecionado` nunca chega a ser
      // preenchido, mesmo com o campo presente na mensagem.
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(host.sessionId);

      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Resolve como Super Trunfo sem oposicao -- prova que o `atributo`
      // enviado nao influenciou o resultado (nao virou uma comparacao de
      // Velocidade Maxima).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.ultimoResultado.tipoVitoria).toBe("superTrunfo");
      expect(room.state.ultimoResultado.atributo).toBe("");

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  /**
   * Achado da revisao (verification-gap): ate aqui, o 3o Acceptance
   * Criterion da Story ("mais de um oponente com Carta 'A', vence quem
   * estiver mais proximo em ordem circular") so era exercitado por
   * `superTrunfo.test.ts` (funcao pura, sem Room) e por um teste de
   * componente do frontend (Room falsa) -- nunca pela `PartidaRoom` real
   * com `state.jogadores`/`resolverRodada`. Mesma classe de gap que
   * revelou o bug real de `ArraySchema.parentIndex` na Story 2.3 (ver
   * Spec Change Log daquela historia) -- sobe 4 Jogadores humanos reais,
   * forca 2 deles com Carta letra "A" (distancias diferentes do Jogador
   * do Super Trunfo) e confere que o MAIS PROXIMO na ordem circular vence,
   * com visibilidade verificada via estado decodificado de cliente real.
   */
  it("Matrix: 4 Jogadores reais, 2 oponentes com Carta 'A' -- vence quem esta mais proximo em ordem circular do Jogador do Super Trunfo", async () => {
    // Ordem de entrada (= state.jogadores = ordem round-robin de distribuir):
    // host(0)=6D (Super Trunfo) -- convidado1(1)=2B (sem "A", mais proximo)
    // -- convidado2(2)=3A ("A", 2 passos -- deveria vencer) --
    // convidado3(3)=4A ("A", 3 passos -- tem "A" tambem, mas mais longe,
    // nunca deveria vencer).
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["6D", "2B", "3A", "4A"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
      const convidado2 = await testServer.connectTo(room, { nome: "Carla" }); // topo forcado: 3A, deveria vencer
      const convidado3 = await testServer.connectTo(room, { nome: "Bruno" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Premissa do teste: confirma os 4 topos forcados antes de seguir.
      const topoPorSessionId = new Map(
        room.state.jogadores.map((jogador) => [jogador.sessionId, jogador.monte[0]?.id]),
      );
      expect(topoPorSessionId.get(host.sessionId)).toBe("6D");
      expect(topoPorSessionId.get(convidado1.sessionId)).toBe("2B");
      expect(topoPorSessionId.get(convidado2.sessionId)).toBe("3A");
      expect(topoPorSessionId.get(convidado3.sessionId)).toBe("4A");

      host.send("jogarCarta", {});
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(host.sessionId);

      // Visibilidade concedida a TODOS os 4 Clients durante
      // "SuperTrunfoAcionado" -- verificado via estado decodificado de
      // cliente real (nao so `room.state` do servidor), nao so entre 2
      // Clients como os testes anteriores deste describe.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const clientesReais = [host, convidado1, convidado2, convidado3];
      const idsEsperados = ["6D", "2B", "3A", "4A"];
      for (const clienteQueOlha of clientesReais) {
        const jogadoresNoEstadoLocal = clienteQueOlha.state.jogadores as Array<{
          sessionId: string;
          monte?: { id: string }[];
        }>;
        for (let indice = 0; indice < clientesReais.length; indice++) {
          const jogadorObservado = jogadoresNoEstadoLocal.find(
            (jogador) => jogador.sessionId === clientesReais[indice].sessionId,
          );
          expect(jogadorObservado?.monte?.[0]?.id).toBe(idsEsperados[indice]);
        }
      }

      // A pausa de revelacao e' real -- aguarda o timer do servidor.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor: convidado2 (Carla, "3A") -- o MAIS PROXIMO com Carta "A"
      // em ordem circular a partir do host (indice 0), NUNCA convidado3
      // (Bruno, "4A"), que tambem tem "A" mas esta mais longe, e NUNCA o
      // proprio host (a Super Trunfo foi anulada, nao venceu sem oposicao).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidado2.sessionId);
      expect(room.state.ultimoResultado.vencedorNome).toBe("Carla");
      expect(room.state.ultimoResultado.tipoVitoria).toBe("cartaA");
      expect(room.state.ultimoResultado.atributo).toBe("");

      // Convidado2 coletou as 4 Cartas jogadas (8 -> 7 jogada, + 4
      // coletadas = 11); os outros 3 so perderam a propria (8 -> 7).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado1 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado1.sessionId,
      );
      const jogadorConvidado2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      );
      const jogadorConvidado3 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado3.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(7);
      expect(jogadorConvidado1?.quantidadeCartas).toBe(7);
      expect(jogadorConvidado2?.quantidadeCartas).toBe(11);
      expect(jogadorConvidado3?.quantidadeCartas).toBe(7);

      // As 4 Cartas especificas (incluindo a propria Super Trunfo, "6D")
      // estao de verdade no fundo do Monte da vencedora, na ordem de
      // `state.jogadores` (host, convidado1, convidado2, convidado3).
      expect(jogadorConvidado2?.monte.slice(-4).map((carta) => carta.id)).toEqual([
        "6D",
        "2B",
        "3A",
        "4A",
      ]);

      await host.leave();
      await convidado1.leave();
      await convidado2.leave();
      await convidado3.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);
});

/**
 * Camada de integracao de Room (AD-12) da Story 2.3: cobre o fluxo
 * completo de `resolverRodada` -- agendado via `this.clock.setTimeout`
 * (`DURACAO_REVELACAO_MS`) ao final de `jogarCarta`. Forca cartas
 * conhecidas pro topo do Monte de host/convidado (mesmo truque de
 * `embaralharOverride` usado no describe anterior) pra ter um resultado
 * deterministico -- vencedor unico e empate.
 */
describe("PartidaRoom -- resolverRodada (Story 2.3)", () => {
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
   * Forca as 2 Cartas dadas pro topo do Monte de host/convidado
   * respectivamente -- `distribuir` faz round-robin a partir do indice 0,
   * e `jogadores[0]`/`jogadores[1]` sao sempre host/convidado (ordem de
   * entrada), entao `baralhoEmbaralhado[0]`/`[1]` viram exatamente os
   * topos dos dois Montes.
   */
  function forcarTopos(idHost: string, idConvidado: string) {
    return (cartas: Carta[]) => {
      const cartaHost = cartas.find((carta) => carta.id === idHost)!;
      const cartaConvidado = cartas.find((carta) => carta.id === idConvidado)!;
      const resto = cartas.filter((carta) => carta.id !== idHost && carta.id !== idConvidado);
      return [cartaHost, cartaConvidado, ...resto];
    };
  }

  it("Matrix: vencedor unico -- coleta as 2 Cartas jogadas pro fundo do proprio Monte, jogadorDaVez vira o vencedor, estado volta pra AguardandoSelecao, apos a pausa de revelacao", async () => {
    // 2B (440 km/h) > 8B (250 km/h), nenhuma das duas e Super Trunfo --
    // vencedor determinado por Velocidade Maxima, sem ambiguidade.
    embaralharOverride.atual = forcarTopos("2B", "8B");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // A pausa de revelacao e' real (`DURACAO_REVELACAO_MS` = 2500ms) --
      // aguarda o timer do servidor de verdade em vez de mockar o clock.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor (host, 2B) vira o Jogador da vez; rodadaAtual e limpa.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

      // Host jogou 1 Carta (16 -> 15) e recebeu as 2 Cartas jogadas no
      // fundo do proprio Monte (15 + 2 = 17); convidado so perdeu a sua (15).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(17);
      expect(jogadorConvidado?.quantidadeCartas).toBe(15);

      // Achado da revisao do diff: so a contagem agregada nao prova que a
      // Carta CERTA foi movida (um bug que trocasse/descartasse a Carta
      // errada mantendo a contagem passaria batido). Confere as 2 Cartas
      // especificas que foram jogadas (2B do host, 8B do convidado) de
      // verdade no FUNDO do Monte do vencedor, na ordem que jogaram
      // (`jogadoresQueJogaram` segue a ordem de `state.jogadores`: host
      // primeiro, convidado depois).
      expect(jogadorHost?.monte.slice(-2).map((carta) => carta.id)).toEqual(["2B", "8B"]);

      // `ultimoResultado` (publico, Chip de Resultado do frontend).
      expect(room.state.ultimoResultado.vencedorNome).toBe("Mauricio");
      expect(room.state.ultimoResultado.atributo).toBe("velocidadeMaxima");

      // Da tempo do patch de StateView (revogacao + nova concessao)
      // propagar pro estado local decodificado de cada cliente.
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Visibilidade apos resolucao (Matrix): cada um ve so a PROPRIA
      // Carta nova -- ninguem continua vendo conteudo de Carta da Rodada
      // anterior, nem a propria antiga, nem a do oponente. O Monte do
      // oponente pode continuar existindo como array local (o
      // `client.view` ja conhecia o container desde a revelacao), mas
      // sempre VAZIO (`?? 0` cobre tanto `undefined` quanto `[]`) -- nunca
      // com conteudo de Carta.
      const meuNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      const oponenteNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      expect(meuNoHost?.monte?.length).toBe(1);
      expect(meuNoHost?.monte?.[0]?.id).not.toBe("2B"); // nao e mais a Carta jogada
      expect(oponenteNoHost?.monte?.length ?? 0).toBe(0); // conteudo do oponente, invisivel de novo

      const meuNoConvidado = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      const oponenteNoConvidado = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      expect(meuNoConvidado?.monte?.length).toBe(1);
      expect(meuNoConvidado?.monte?.[0]?.id).not.toBe("8B");
      expect(oponenteNoConvidado?.monte?.length ?? 0).toBe(0);

      // Achado da revisao do diff: nenhum teste ainda chamava `jogarCarta`
      // uma SEGUNDA vez -- um bug que so aparece na 2a Rodada (ex:
      // `StateView` nao limpo direito entre a revogacao da Rodada anterior
      // e a nova concessao) passaria batido pela suite inteira. Encadeia
      // uma 2a Rodada completa aqui: o vencedor da 1a (host) e o novo
      // Jogador da vez; o novo topo forcado do host e' "1A" (325 km/h,
      // proxima Carta na ordem round-robin de `distribuir` depois de "2B"
      // ter sido removida -- ver `forcarTopos`/comentario da distribuicao
      // no topo do arquivo), o do convidado e' "1B" (315 km/h) -- valores
      // diferentes, sem ambiguidade de vencedor de novo.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Host vence de novo (1A > 1B) -- continua sendo o Jogador da vez;
      // coleta as 2 Cartas desta 2a Rodada tambem, no fundo do Monte.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      const jogadorHostRodada2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidadoRodada2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHostRodada2?.quantidadeCartas).toBe(18); // 17 - 1 jogada + 2 coletadas
      expect(jogadorConvidadoRodada2?.quantidadeCartas).toBe(14); // 15 - 1 jogada
      expect(jogadorHostRodada2?.monte.slice(-2).map((carta) => carta.id)).toEqual(["1A", "1B"]);

      // Da tempo do patch de StateView da 2a resolucao propagar.
      await new Promise((resolve) => setTimeout(resolve, 150));

      // O ponto central do achado: cada um continua vendo SO a propria
      // Carta do topo NOVA -- nem a Carta antiga ja revogada (nem a "2B"
      // da 1a Rodada, nem a "1A" que acabou de jogar agora), nem a do
      // oponente (nem "8B" da 1a Rodada, nem "1B" desta).
      const meuNoHostRodada2 = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      const oponenteNoHostRodada2 = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      expect(meuNoHostRodada2?.monte?.length).toBe(1);
      expect(meuNoHostRodada2?.monte?.[0]?.id).toBe("1C"); // novo topo do host apos jogar "1A"
      expect(oponenteNoHostRodada2?.monte?.length ?? 0).toBe(0);

      const meuNoConvidadoRodada2 = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      const oponenteNoConvidadoRodada2 = convidado.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      expect(meuNoConvidadoRodada2?.monte?.length).toBe(1);
      expect(meuNoConvidadoRodada2?.monte?.[0]?.id).toBe("1D"); // novo topo do convidado apos jogar "1B"
      expect(oponenteNoConvidadoRodada2?.monte?.length ?? 0).toBe(0);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 25000);

  it("Matrix: empate simples -- Cartas da Rodada vao pro Funil, jogadorDaVez preservado, estado volta DIRETO pra AguardandoSelecao (nunca fica parado em Funil, Story 2.5)", async () => {
    // 4A e 8D tem a mesma Velocidade Maxima (260 km/h) -- empate garantido.
    embaralharOverride.atual = forcarTopos("4A", "8D");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // Story 2.5 (Design Notes do spec): a transicao de desempate e
      // inteiramente sincrona dentro do callback de `resolverRodada` --
      // "Funil" nunca fica parado como um valor visivel em rede, `estado`
      // volta DIRETO pra "AguardandoSelecao" na mesma resolucao.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // jogadorDaVez continua sendo quem abriu a Rodada empatada (host,
      // nao passa a vez); rodadaAtual e limpa pra uma NOVA selecao (mesma
      // Rodada logica); `ultimoResultado` e limpo (sem isso o Chip
      // mostraria a ultima vitoria de verdade como se fosse desta Rodada).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);
      expect(room.state.ultimoResultado.vencedorNome).toBe("");
      expect(room.state.ultimoResultado.atributo).toBe("");

      // As 2 Cartas da Rodada saem do topo de cada Jogador (o topo NOVO ja
      // e a proxima Carta do Monte) e vao pro Funil -- contagem publica
      // reflete isso.
      expect(room.state.funil.quantidadeCartasPresas).toBe(2);

      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(15); // 16 - 1 (4A foi pro Funil)
      expect(jogadorConvidado?.quantidadeCartas).toBe(15); // 16 - 1 (8D foi pro Funil)
      expect(jogadorHost?.monte[0]?.id).not.toBe("4A");
      expect(jogadorConvidado?.monte[0]?.id).not.toBe("8D");

      // StateView: a Carta que foi pro Funil e revogada de todo Client, o
      // NOVO topo de cada Jogador e concedido de novo so pro proprio dono
      // -- mesmo padrao pos-vitoria (Story 2.3).
      await new Promise((resolve) => setTimeout(resolve, 150));
      const meuNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      );
      const oponenteNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === convidado.sessionId,
      );
      expect(meuNoHost?.monte?.length).toBe(1);
      expect(meuNoHost?.monte?.[0]?.id).not.toBe("4A");
      expect(oponenteNoHost?.monte?.length ?? 0).toBe(0); // revogado, nao e mais visivel

      // `funil.cartasPresas` NUNCA vaza StateView pra nenhum Client, mesmo
      // com a contagem publica (`quantidadeCartasPresas`) visivel pra
      // todos -- mesma postura padrao-segura de `Rodada.cartasEmDisputa`.
      expect((host.state.funil as { quantidadeCartasPresas: number }).quantidadeCartasPresas).toBe(
        2,
      );
      expect((host.state.funil as { cartasPresas?: unknown[] }).cartasPresas).toBeUndefined();
      expect(
        (convidado.state.funil as { quantidadeCartasPresas: number }).quantidadeCartasPresas,
      ).toBe(2);
      expect((convidado.state.funil as { cartasPresas?: unknown[] }).cartasPresas).toBeUndefined();

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  /**
   * Achado original da revisao do diff (Story 2.3): um Jogador (principalmente
   * o vencedor) se desconectando durante os 2,5s de "Revelando" podia fazer
   * `resolverRodada` -- rodando 2,5s depois, ja com `onLeave` (Story 1.4)
   * tendo removido esse Jogador de `state.jogadores` -- perder Cartas (nunca
   * empurradas em lugar nenhum) e deixar `rodadaAtual.jogadorDaVez`
   * apontando pra uma sessao inexistente, travando a Partida pra sempre.
   *
   * ATUALIZADO pela Story 3.2 (Design Notes do spec): `onLeave` numa
   * Partida em andamento NUNCA mais remove -- converte o `Jogador` pra
   * `isIA = true` no lugar, preservando Monte/posicao/nome. Esta classe de
   * risco (o "vencedor desconectou durante a pausa" perdendo Cartas/travando
   * `jogadorDaVez`) deixa de ser alcancavel por este caminho: o convidado
   * que teria vencido continua em `state.jogadores` (agora como IA) e
   * `resolverRodada` credita a vitoria dele normalmente, como se tivesse
   * continuado conectado. Os `if (!vencedor) return` defensivos em
   * `resolverRodada` continuam no codigo (nunca fazem mal), mas este teste
   * agora prova o caminho feliz de verdade em vez do abort defensivo.
   */
  it("Story 3.2: o Jogador que teria vencido desconecta durante Revelando -- vira IA, resolverRodada credita a vitoria dele normalmente (sem perder Carta nem travar)", async () => {
    // 8B (host, 250 km/h) < 2B (convidado, 440 km/h) -- o convidado vence a
    // comparacao mesmo desconectando durante a pausa.
    embaralharOverride.atual = forcarTopos("8B", "2B");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      const convidadoSessionId = convidado.sessionId;
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidadoSessionId,
      )!;

      // O convidado (que vai vencer) desconecta durante a pausa de
      // revelacao, bem antes do timer de 2,5s disparar -- `onLeave` (Story
      // 3.2) converte pra IA em vez de remover.
      await convidado.leave();
      await vi.waitFor(() => {
        expect(jogadorConvidado.isIA).toBe(true);
      });
      // Nunca removido -- os 2 assentos continuam em state.jogadores.
      expect(room.state.jogadores).toHaveLength(2);

      // Aguarda o timer de resolucao real disparar. Sem crash (a promise
      // deste teste so resolveria se o callback do `this.clock.setTimeout`
      // rodasse sem excecao) -- `jogadorDaVez` vira o convidado (o vencedor
      // de verdade, sessionId antigo preservado) -- nunca uma sessao
      // inexistente, e nunca "cai" pro host so porque a sessao real do
      // convidado caiu. Espera por `jogadorDaVez` (nao por
      // `estado === "AguardandoSelecao"`): como o convidado (vencedor)
      // agora e IA, `despacharJogadaDeIA` dispara a Rodada 2 na MESMA
      // execucao sincrona de `resolverRodada` (AD-4/Story 3.1) -- o
      // `room.state` nunca fica observavel parado em "AguardandoSelecao"
      // entre as duas Rodadas.
      await vi.waitFor(
        () => {
          expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidadoSessionId);
        },
        { timeout: 5000, interval: 50 },
      );

      expect(room.state.jogadores).toHaveLength(2);
      // Continuidade sem interrupcao (Design Notes do spec): a Rodada 2 ja
      // esta em andamento automaticamente, sem nenhum Client extra
      // precisar mandar nada.
      expect(room.state.estado).toBe("Revelando");

      // Coleta normal: convidado jogou 1 Carta (16 -> 15) e coletou as 2
      // jogadas na Rodada (propria + a do host, 15 + 2 = 17); host so
      // perdeu a sua (16 -> 15). Nenhuma Carta perdida/duplicada.
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(15);
      expect(jogadorConvidado.quantidadeCartas).toBe(17);
      expect(jogadorConvidado.monte.slice(-2).map((carta) => carta.id)).toEqual(["8B", "2B"]);

      await host.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  /**
   * Achado da revisao do diff: ate aqui, so o nivel unitario de
   * `determinarVencedor` cobria mais de 2 candidatos -- o caminho REAL de
   * coleta (`shift`/`push` em multiplos Montes, `StateView` revogado e
   * concedido pra mais de 2 Clients de verdade) nunca foi exercitado com
   * mais de 2 Jogadores via pipeline completo de Room/`StateView`. Sobe 4
   * Jogadores humanos reais, forca 4 Cartas com valores distintos, e
   * confere a resolucao completa: coleta certa, `StateView` revogada/
   * concedida pra TODOS os 4 clientes, nao so 2.
   */
  it("Matrix: 4 Jogadores reais -- coleta as 4 Cartas jogadas pro Monte do vencedor, StateView revogada/concedida pros 4 Clients (nao so 2)", async () => {
    // Velocidade Maxima distinta pra cada um, vencedor sem ambiguidade:
    // 7B (484) > 2B (440) > 6A (307) > 8B (250).
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["2B", "8B", "7B", "6A"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
      const convidado2 = await testServer.connectTo(room, { nome: "Carla" }); // topo forcado: 7B (484), vencedor
      const convidado3 = await testServer.connectTo(room, { nome: "Bruno" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Premissa do teste: `distribuir` faz round-robin a partir do indice
      // 0 na ordem de `state.jogadores` (ordem de entrada) -- confirma que
      // os 4 topos batem com os IDs forcados antes de seguir.
      const topoPorSessionId = new Map(
        room.state.jogadores.map((jogador) => [jogador.sessionId, jogador.monte[0]?.id]),
      );
      expect(topoPorSessionId.get(host.sessionId)).toBe("2B");
      expect(topoPorSessionId.get(convidado1.sessionId)).toBe("8B");
      expect(topoPorSessionId.get(convidado2.sessionId)).toBe("7B");
      expect(topoPorSessionId.get(convidado3.sessionId)).toBe("6A");

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor: convidado2 (Carla, 7B = 484 km/h, o maior valor entre os 4).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidado2.sessionId);
      expect(room.state.ultimoResultado.vencedorNome).toBe("Carla");

      // Cada um dos outros 3 jogou 1 Carta (8 -> 7); o vencedor jogou a
      // propria (8 -> 7) e recebeu as 4 Cartas jogadas no fundo do proprio
      // Monte (7 + 4 = 11).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado1 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado1.sessionId,
      );
      const jogadorConvidado2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      );
      const jogadorConvidado3 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado3.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(7);
      expect(jogadorConvidado1?.quantidadeCartas).toBe(7);
      expect(jogadorConvidado2?.quantidadeCartas).toBe(11);
      expect(jogadorConvidado3?.quantidadeCartas).toBe(7);

      // As 4 Cartas especificas jogadas estao de verdade no fundo do Monte
      // do vencedor (ordem de `jogadoresQueJogaram`, que segue a ordem de
      // `state.jogadores`: host, convidado1, convidado2, convidado3).
      expect(jogadorConvidado2?.monte.slice(-4).map((carta) => carta.id)).toEqual([
        "2B",
        "8B",
        "7B",
        "6A",
      ]);

      // Da tempo do patch de StateView (revogacao + nova concessao)
      // propagar pro estado local decodificado de CADA um dos 4 clientes.
      await new Promise((resolve) => setTimeout(resolve, 150));

      const clientesReais = [host, convidado1, convidado2, convidado3];
      for (const clienteQueOlha of clientesReais) {
        const jogadoresNoEstadoLocal = clienteQueOlha.state.jogadores as Array<{
          sessionId: string;
          monte?: { id: string }[];
        }>;

        for (const clienteObservado of clientesReais) {
          const jogadorObservado = jogadoresNoEstadoLocal.find(
            (jogador) => jogador.sessionId === clienteObservado.sessionId,
          );

          if (clienteObservado.sessionId === clienteQueOlha.sessionId) {
            // A propria Carta nova (unica visivel) -- nunca a antiga
            // revogada.
            expect(jogadorObservado?.monte?.length).toBe(1);
            expect(["2B", "8B", "7B", "6A"]).not.toContain(jogadorObservado?.monte?.[0]?.id);
          } else {
            // Conteudo de Carta de QUALQUER outro Jogador, invisivel --
            // nao so de 1 oponente como nos testes de 2 Jogadores, dos
            // outros 3 simultaneamente.
            expect(jogadorObservado?.monte?.length ?? 0).toBe(0);
          }
        }
      }

      await host.leave();
      await convidado1.leave();
      await convidado2.leave();
      await convidado3.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);
});

/**
 * Camada de integracao de Room (AD-12) da Story 2.5: cobre o resto da
 * Matrix do Funil que o describe anterior (empate simples, dentro do
 * describe de resolverRodada da Story 2.3) nao cobre -- uma Rodada de
 * desempate que finalmente resolve SEM empate (o vencedor leva a Rodada
 * inteira MAIS tudo que estava retido no Funil) e empates CONSECUTIVOS da
 * mesma sequencia de desempate (o Funil acumula, `jogadorDaVez` continua o
 * mesmo pra cada Rodada de desempate).
 */
describe("PartidaRoom -- Funil (Story 2.5)", () => {
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
   * Forca uma sequencia INTEIRA de topos alternados host/convidado
   * (round-robin de `distribuir` a partir do indice 0) -- `idsForcados[0]`
   * vira o topo do host na Rodada 1, `idsForcados[1]` o do convidado na
   * Rodada 1, `idsForcados[2]` o do host na Rodada 2, e assim por diante.
   */
  function forcarSequenciaDeTopos(idsForcados: string[]) {
    return (cartas: Carta[]) => {
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };
  }

  it("Matrix: nova Rodada sem empate apos o Funil -- vencedor coleta a nova Carta, a do adversario, E tudo que estava retido no Funil; Funil esvazia", async () => {
    // Rodada 1 (empate): 4A x 8D, ambas 260 km/h -- vao pro Funil.
    // Rodada 2 (sem empate): 2B (440) x 8B (250) -- host vence, leva a
    // propria Rodada inteira MAIS as 2 Cartas retidas do Funil.
    embaralharOverride.atual = forcarSequenciaDeTopos(["4A", "8D", "2B", "8B"]);

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Rodada 1: empate -- Funil acumula 2 Cartas, jogadorDaVez continua
      // sendo o host (quem abriu a Rodada empatada).
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.funil.quantidadeCartasPresas).toBe(2);
        },
        { timeout: 5000, interval: 50 },
      );
      expect(room.state.estado).toBe("AguardandoSelecao");
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

      // Rodada 2 (de desempate): o proprio host (que abriu a Rodada
      // empatada) escolhe de novo o Atributo, com a Carta que sobrou no
      // topo -- sem passar a vez.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // Vencedor: host (2B, 440 km/h > 8B, 250 km/h). Funil esvazia.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.ultimoResultado.vencedorNome).toBe("Mauricio");
      expect(room.state.ultimoResultado.atributo).toBe("velocidadeMaxima");
      expect(room.state.funil.quantidadeCartasPresas).toBe(0);

      // Host: 16 - 1 (4A pro Funil) - 1 (2B jogada) + 2 (2B+8B coletadas) +
      // 2 (4A+8D do Funil) = 18. Convidado: 16 - 1 (8D pro Funil) - 1 (8B
      // jogada, perdida) = 14.
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(18);
      expect(jogadorConvidado?.quantidadeCartas).toBe(14);

      // As 4 Cartas especificas (as 2 da Rodada vencedora + as 2 que
      // estavam retidas no Funil) estao de verdade no fundo do Monte do
      // vencedor -- Rodada primeiro (`cartasColetadas`), Funil depois
      // (ordem do `push` em `resolverRodada`).
      expect(jogadorHost?.monte.slice(-4).map((carta) => carta.id)).toEqual([
        "2B",
        "8B",
        "4A",
        "8D",
      ]);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: empates consecutivos -- Funil acumula as Cartas das 2 Rodadas empatadas, jogadorDaVez continua o mesmo, ate uma 3a Rodada resolver sem empate", async () => {
    // Rodada 1 (empate): 4A x 8D, 260 km/h.
    // Rodada 2 (empate de novo): 1A x 1C, 325 km/h.
    // Rodada 3 (sem empate): 2B (440) x 8B (250) -- host vence, leva a
    // Rodada inteira MAIS as 4 Cartas acumuladas nas 2 Rodadas empatadas.
    embaralharOverride.atual = forcarSequenciaDeTopos(["4A", "8D", "1A", "1C", "2B", "8B"]);

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Rodada 1: empate -- Funil acumula 2 Cartas.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.funil.quantidadeCartasPresas).toBe(2);
        },
        { timeout: 5000, interval: 50 },
      );
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

      // Rodada 2: empate DE NOVO -- Funil acumula as 2 novas Cartas em
      // cima das 2 anteriores (total 4), jogadorDaVez continua o mesmo
      // (host, a mesma sequencia de desempate).
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.funil.quantidadeCartasPresas).toBe(4);
        },
        { timeout: 5000, interval: 50 },
      );
      expect(room.state.estado).toBe("AguardandoSelecao");
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

      // Rodada 3: sem empate -- host vence e leva a Rodada inteira MAIS as
      // 4 Cartas acumuladas no Funil das 2 Rodadas empatadas.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      expect(room.state.ultimoResultado.vencedorNome).toBe("Mauricio");
      expect(room.state.funil.quantidadeCartasPresas).toBe(0);

      // Host: 16 - 1 (4A) - 1 (1A) - 1 (2B jogada) + 2 (2B+8B coletadas) +
      // 4 (4A+8D+1A+1C do Funil) = 19. Convidado: 16 - 1 (8D) - 1 (1C) - 1
      // (8B jogada, perdida) = 13.
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      expect(jogadorHost?.quantidadeCartas).toBe(19);
      expect(jogadorConvidado?.quantidadeCartas).toBe(13);

      // As 6 Cartas (2 da Rodada vencedora + as 4 acumuladas nas 2 Rodadas
      // empatadas, na ordem em que foram presas ao Funil) no fundo do
      // Monte do vencedor.
      expect(jogadorHost?.monte.slice(-6).map((carta) => carta.id)).toEqual([
        "2B",
        "8B",
        "4A",
        "8D",
        "1A",
        "1C",
      ]);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 20000);
});

/**
 * Camada de integracao de Room (AD-12) da Story 2.6: cobre a Matrix inteira
 * de eliminacao/Fim de Partida -- eliminacao simples (Partida continua),
 * Fim de Partida por coleta e por atrito (empate elimina todos os demais de
 * uma vez), vez pulando o proprio Jogador recem-eliminado num empate, e o
 * caso degenerado (empate elimina TODOS que jogaram, ninguem sobra).
 *
 * Reduz o Monte de um Jogador diretamente em `room.state` (em vez de jogar
 * dezenas de Rodadas reais ate esvaziar organicamente) -- mesmo espirito de
 * `embaralharOverride`/`forcarTopos` ja usado nos describes anteriores pra
 * ter um resultado deterministico, so que truncando o TAMANHO do Monte em
 * vez do CONTEUDO do topo. Sempre reatribui `monte` a uma instancia NOVA de
 * `ArraySchema` (nunca `splice()`/`slice()` in-place na mesma instancia) --
 * mesma cautela de `parentIndex` documentada em `PartidaRoom.resolverRodada`.
 */
describe("PartidaRoom -- Fim de Partida e Eliminacao (Story 2.6)", () => {
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

  it("Matrix: eliminacao simples -- Monte de um Jogador chega a 0 numa Rodada sem empate, mas 2+ Jogadores continuam ativos -- Partida NAO acaba, eliminado some da revelacao seguinte", async () => {
    // 2B (440, host) > 1B (315, convidado1) > 8B (250, convidado2) --
    // vencedor sem ambiguidade, convidado2 perde e (com o Monte truncado
    // pra 1 Carta abaixo) fica eliminado por esta Rodada.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["2B", "1B", "8B"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 3, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
      const convidado2 = await testServer.connectTo(room, { nome: "Carla" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Truncamento de teste: so convidado2 (quem vai perder) fica com 1
      // Carta -- host/convidado1 mantem o Monte real de 10 Cartas (32/3,
      // AD-6) que `iniciarPartida` ja distribuiu.
      const jConvidado2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      )!;
      expect(jConvidado2.monte[0]?.id).toBe("8B"); // premissa do teste
      jConvidado2.monte = new ArraySchema<Carta>(jConvidado2.monte[0]);
      jConvidado2.quantidadeCartas = jConvidado2.monte.length;

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // convidado2 eliminado (Monte zerado), mas host e convidado1
      // continuam ativos -- a Partida NAO acaba, so uma eliminacao simples.
      const jHostDepois = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jConvidado1Depois = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado1.sessionId,
      );
      const jConvidado2Depois = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      );
      expect(jConvidado2Depois?.quantidadeCartas).toBe(0);
      expect(jHostDepois?.quantidadeCartas).toBe(12); // 10 - 1 jogada + 3 coletadas (propria+convidado1+convidado2)
      expect(jConvidado1Depois?.quantidadeCartas).toBe(9); // 10 - 1 jogada, perdida
      expect(room.state.estado).toBe("AguardandoSelecao");
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

      // Rodada seguinte: convidado2 (eliminado) some da revelacao -- so 2
      // Cartas em disputa (host + convidado1), nunca 3.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2);

      await host.leave();
      await convidado1.leave();
      await convidado2.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: Fim de Partida por coleta -- um unico Jogador ativo resta apos uma Rodada SEM empate, estado vira FimDePartida, nenhuma nova Rodada comeca", async () => {
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["2B", "8B"]; // 440 x 250, host vence sem ambiguidade
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Truncamento de teste: os 2 Montes ficam com so a propria Carta
      // forcada -- assim UMA Rodada decisiva ja basta pra zerar o
      // perdedor, sem precisar jogar as ~16 Rodadas reais que levariam pra
      // alguem reunir o Baralho inteiro organicamente.
      const jHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      const jConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;
      jHost.monte = new ArraySchema<Carta>(jHost.monte[0]);
      jHost.quantidadeCartas = jHost.monte.length;
      jConvidado.monte = new ArraySchema<Carta>(jConvidado.monte[0]);
      jConvidado.quantidadeCartas = jConvidado.monte.length;

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("FimDePartida");
        },
        { timeout: 5000, interval: 50 },
      );

      const jHostDepois = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      const jConvidadoDepois = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      );
      // Host reuniu as 2 Cartas (a propria + a do convidado, unicas 2 do
      // Baralho truncado neste teste) -- convidado fica com 0.
      expect(jHostDepois?.quantidadeCartas).toBe(2);
      expect(jConvidadoDepois?.quantidadeCartas).toBe(0);

      // Achado da revisao de codigo: `encerrarPartida()` (bookkeeping
      // comum aos dois caminhos que podem terminar a Partida) limpa
      // `rodadaAtual` inteira -- sem isso, este caminho especifico
      // (vitoria por coleta) deixava `atributoSelecionado`/
      // `superTrunfoJogadoPor`/`cartasEmDisputa` da ULTIMA Rodada jogada
      // grudados no estado publico pra sempre.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe("");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

      // Nenhuma nova Rodada comeca: jogarCarta enviado depois disso e
      // rejeitado (estado != AguardandoSelecao), sem crash.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.estado).toBe("FimDePartida");

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: Fim de Partida por atrito -- um empate elimina TODOS os outros Jogadores de uma vez, o unico sobrevivente absorve o Funil, estado vira FimDePartida mesmo sem ter vencido uma comparacao", async () => {
    // 1A, 1C, 3B empatam em 325 km/h (3-way tie) -- os 3 tem so 1 Carta
    // cada, entao os 3 ficam eliminados por este empate. 8B (250, o
    // convidado3) tem valor distinto (nao participa do empate), mas ainda
    // perde a propria Carta do topo pro Funil (TODOS que jogaram vao pro
    // Funil num empate) -- como convidado3 tem 2 Cartas, sobrevive como o
    // unico ativo restante.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["1A", "1C", "3B", "8B"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
      const convidado2 = await testServer.connectTo(room, { nome: "Carla" });
      const convidado3 = await testServer.connectTo(room, { nome: "Bruno" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      const jHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      const jConvidado1 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado1.sessionId,
      )!;
      const jConvidado2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      )!;
      const jConvidado3 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado3.sessionId,
      )!;
      // Premissa do teste: confirma os 4 topos forcados antes de truncar.
      expect(jHost.monte[0]?.id).toBe("1A");
      expect(jConvidado1.monte[0]?.id).toBe("1C");
      expect(jConvidado2.monte[0]?.id).toBe("3B");
      expect(jConvidado3.monte[0]?.id).toBe("8B");

      jHost.monte = new ArraySchema<Carta>(jHost.monte[0]);
      jHost.quantidadeCartas = jHost.monte.length;
      jConvidado1.monte = new ArraySchema<Carta>(jConvidado1.monte[0]);
      jConvidado1.quantidadeCartas = jConvidado1.monte.length;
      jConvidado2.monte = new ArraySchema<Carta>(jConvidado2.monte[0]);
      jConvidado2.quantidadeCartas = jConvidado2.monte.length;
      // convidado3 mantem 2 Cartas (a forcada + a que "caiu" a seguir na
      // distribuicao round-robin) -- sobrevive a perder so a do topo.
      jConvidado3.monte = new ArraySchema<Carta>(...jConvidado3.monte.slice(0, 2));
      jConvidado3.quantidadeCartas = jConvidado3.monte.length;

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("FimDePartida");
        },
        { timeout: 5000, interval: 50 },
      );

      expect(jHost.quantidadeCartas).toBe(0);
      expect(jConvidado1.quantidadeCartas).toBe(0);
      expect(jConvidado2.quantidadeCartas).toBe(0);
      // convidado3: 1 Carta que sobrou (perdeu so a do topo) + 4 do Funil
      // (as 4 Cartas desta Rodada empatada -- 1A, 1C, 3B, 8B).
      expect(jConvidado3.quantidadeCartas).toBe(5);
      expect(room.state.funil.quantidadeCartasPresas).toBe(0); // absorvido, esvaziou

      // Achado da revisao de codigo: `encerrarPartida()` limpa
      // `rodadaAtual.jogadorDaVez` -- sem isso, este caminho especifico
      // (vitoria por atrito) nunca rodava o skip de vez, podendo deixar
      // `jogadorDaVez` apontando pro proprio host, que foi um dos
      // Jogadores eliminados por este mesmo empate.
      expect(room.state.rodadaAtual.jogadorDaVez).toBe("");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

      await host.leave();
      await convidado1.leave();
      await convidado2.leave();
      await convidado3.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: vez pula o proprio Jogador recem-eliminado -- um empate elimina o jogadorDaVez, mas 2+ Jogadores continuam ativos -- a vez avanca (ordem circular de entrada), pulando qualquer outro tambem eliminado no caminho", async () => {
    // 1A (host, jogadorDaVez) e 1C (convidado1) empatam em 325 -- ambos com
    // so 1 Carta, os dois ficam eliminados. 8B (convidado2) e 6D
    // (convidado3) tem valores distintos e mais baixos (nao participam do
    // empate), mas cada um mantem 2 Cartas -- sobrevivem, ativos. Os 4
    // ids seguintes (posicoes 4-7) controlam a 2a Carta de cada Jogador na
    // distribuicao round-robin (`distribuir`, indice%4) -- fixados so pra
    // garantir que a 2a Carta que sobra pra convidado2/convidado3 NUNCA
    // seja a Super Trunfo ("6D"), o que desviaria a Rodada seguinte deste
    // teste pra "SuperTrunfoAcionado" em vez do fluxo normal de Atributo.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["1A", "1C", "8B", "6D", "1B", "1D", "3A", "3D"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado1 = await testServer.connectTo(room, { nome: "Rafael" });
      const convidado2 = await testServer.connectTo(room, { nome: "Carla" });
      const convidado3 = await testServer.connectTo(room, { nome: "Bruno" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId); // host = sempre o Jogador Inicial

      const jHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      const jConvidado1 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado1.sessionId,
      )!;
      const jConvidado2 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado2.sessionId,
      )!;
      const jConvidado3 = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado3.sessionId,
      )!;

      jHost.monte = new ArraySchema<Carta>(jHost.monte[0]);
      jHost.quantidadeCartas = jHost.monte.length;
      jConvidado1.monte = new ArraySchema<Carta>(jConvidado1.monte[0]);
      jConvidado1.quantidadeCartas = jConvidado1.monte.length;
      jConvidado2.monte = new ArraySchema<Carta>(...jConvidado2.monte.slice(0, 2));
      jConvidado2.quantidadeCartas = jConvidado2.monte.length;
      jConvidado3.monte = new ArraySchema<Carta>(...jConvidado3.monte.slice(0, 2));
      jConvidado3.quantidadeCartas = jConvidado3.monte.length;

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );

      // host e convidado1 (join order: indices 0 e 1) eliminados pelo
      // empate; convidado2/convidado3 continuam ativos.
      expect(jHost.quantidadeCartas).toBe(0);
      expect(jConvidado1.quantidadeCartas).toBe(0);
      expect(jConvidado2.quantidadeCartas).toBe(1);
      expect(jConvidado3.quantidadeCartas).toBe(1);
      expect(room.state.funil.quantidadeCartasPresas).toBe(4);

      // A vez NAO fica travada no host eliminado, nem passa pro proximo da
      // lista se ele TAMBEM estiver eliminado (convidado1) -- avanca
      // (ordem circular de join order) direto pro proximo Jogador ATIVO
      // (convidado2, indice 2).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidado2.sessionId);

      // A Partida NAO acabou (2 Jogadores ainda ativos) -- e o novo
      // jogadorDaVez (convidado2) consegue jogar normalmente.
      convidado2.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2); // so convidado2 + convidado3

      await host.leave();
      await convidado1.leave();
      await convidado2.leave();
      await convidado3.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: caso degenerado -- um empate eliminaria TODOS os Jogadores que jogaram (ninguem ativo sobra na Partida inteira) -- nao crasha, estado/Cartas ficam como estavam, so loga warn", async () => {
    // 4A e 8D empatam em 260 km/h -- os 2 UNICOS Jogadores da Partida, cada
    // um com so 1 Carta: se o empate resolvesse normalmente, os 2 ficariam
    // eliminados ao mesmo tempo, ninguem sobraria ativo.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["4A", "8D"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      const jHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      const jConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;
      jHost.monte = new ArraySchema<Carta>(jHost.monte[0]);
      jHost.quantidadeCartas = jHost.monte.length;
      jConvidado.monte = new ArraySchema<Carta>(jConvidado.monte[0]);
      jConvidado.quantidadeCartas = jConvidado.monte.length;

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // Aguarda o timer real de resolucao disparar -- sem crash (a promise
      // deste teste so resolveria se o callback do `this.clock.setTimeout`
      // rodasse sem excecao). Sem transicao esperada nenhuma pra `waitFor`
      // (o abort deixa tudo exatamente como estava) -- espera passar do
      // tempo da pausa de revelacao com um delay fixo mesmo.
      await new Promise((resolve) => setTimeout(resolve, DURACAO_REVELACAO_MS + 500));

      // Nada mudou: `estado` continua "Revelando" (nunca chega a voltar pra
      // AguardandoSelecao nem vira FimDePartida), nenhuma Carta se moveu
      // (ambos os Montes/`cartasEmDisputa` intocados), Funil continua vazio.
      expect(room.state.estado).toBe("Revelando");
      expect(jHost.quantidadeCartas).toBe(1);
      expect(jHost.monte[0]?.id).toBe("4A");
      expect(jConvidado.quantidadeCartas).toBe(1);
      expect(jConvidado.monte[0]?.id).toBe("8D");
      expect(room.state.funil.quantidadeCartasPresas).toBe(0);
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2);

      expect(avisos).toHaveBeenCalledWith(expect.stringContaining("caso degenerado"));

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
      avisos.mockRestore();
    }
  }, 15000);
});

/**
 * Camada de integracao de Room (AD-12) da Story 3.1: cobre a Matrix inteira
 * de IA -- vaga humana faltante virando IA no inicio, IA vencendo uma
 * Rodada e jogando sozinha (sem nenhum Client enviar `jogarCarta`), IA com
 * Super Trunfo no topo (decidirAtributoIA nem chamada), e IAs consecutivas
 * encadeando (os 2 unicos Jogadores ativos restantes sao IA).
 *
 * Mesmo truque de `embaralharOverride` das suites anteriores pra ter
 * resultados deterministicos; `decidirAtributoIASpy` (topo do arquivo)
 * confirma POSITIVAMENTE quando `decidirAtributoIA` foi/nao foi chamada.
 */
describe("PartidaRoom -- IA (Story 3.1)", () => {
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

  it("Matrix: vaga humana nao preenchida vira IA automaticamente antes da distribuicao, alem da IA ja declarada na criacao", async () => {
    // totalJogadores=3, totalIA=1 (1 IA ja declarada na criacao) -- so o
    // host entra, a 2a vaga humana (convidado que nunca chegou a entrar)
    // fica faltando.
    const room = await testServer.createRoom("partida", { totalJogadores: 3, totalIA: 1 });
    expect(room.state.jogadores).toHaveLength(1); // so a IA declarada na criacao
    expect(room.state.totalIADeclarado).toBe(1);

    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    expect(room.state.jogadores).toHaveLength(2); // IA declarada + host

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });

    // A vaga humana que nunca foi preenchida virou uma 2a IA -- 3 assentos
    // no total, `totalIADeclarado` atualizado pra refletir o total real.
    expect(room.state.jogadores).toHaveLength(3);
    expect(room.state.totalIADeclarado).toBe(2);

    const iAs = room.state.jogadores.filter((jogador) => jogador.isIA);
    expect(iAs).toHaveLength(2);
    // Numeracao continua a partir de `totalIADeclarado` original (1) --
    // "IA 1" (da criacao) e "IA 2" (preenchida no inicio), nunca colidindo.
    expect(iAs.map((jogador) => jogador.nome).sort()).toEqual(["IA 1", "IA 2"]);

    // Todos os 3 assentos (host + 2 IA) receberam Monte igual -- 32/3=10
    // cada, 2 descartadas (AD-6) -- a vaga preenchida no inicio NAO fica de
    // fora da distribuicao.
    for (const jogador of room.state.jogadores) {
      expect(jogador.quantidadeCartas).toBe(10);
      expect(jogador.monte.length).toBeGreaterThan(0);
    }

    await host.leave();
  });

  it("Matrix: IA vence a Rodada e joga sozinha -- decidirAtributoIA dispara na mesma execucao, sem nenhum Client enviar jogarCarta", async () => {
    // jogadores order = [IA (criada em onCreate), host (onJoin)] --
    // distribuir e round-robin a partir do indice 0: posicao0=IA, posicao1=host.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["2B", "8B", "8C"]; // IA=2B(440), host=8B(250), IA(2a carta)=8C(nao ST)
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 1 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      const jogadorIA = room.state.jogadores.find((jogador) => jogador.isIA)!;
      const jogadorHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      expect(jogadorIA.monte[0]?.id).toBe("2B");
      expect(jogadorHost.monte[0]?.id).toBe("8B");
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId); // host = sempre o Jogador Inicial

      decidirAtributoIASpy.mockClear();

      // Unica mensagem enviada por QUALQUER Client neste teste: o host
      // perde de proposito (250 < 440) pra IA virar o Jogador da vez.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // A Rodada 1 (do host) resolve depois da pausa real -- SEM nenhum
      // 2o `send` de ninguem, a IA (vencedora) precisa jogar sozinha e
      // encadear a Rodada 2 automaticamente, na MESMA execucao sincrona de
      // `resolverRodada` (AD-4) -- por isso o teste nunca observa
      // `estado === "AguardandoSelecao"` isolado aqui (Design Notes do
      // spec: a transicao inteira e atomica, sem patch de rede
      // intermediario mostrando o pulso).
      await vi.waitFor(
        () => {
          expect(room.state.rodadaAtual.jogadorDaVez).toBe(jogadorIA.sessionId);
        },
        { timeout: 5000, interval: 50 },
      );

      // decidirAtributoIA disparou (Carta do topo da IA, "8C", nao e Super
      // Trunfo) -- a Rodada 2 ja esta em andamento automaticamente.
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(1);
      expect(room.state.estado).toBe("Revelando");
      const chavesValidas = new Set(ATRIBUTOS.map((atributo) => atributo.chave));
      expect(chavesValidas.has(room.state.rodadaAtual.atributoSelecionado)).toBe(true);
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2);

      // Host perdeu a Rodada 1 (16 -> 15); IA venceu e coletou (16 -> 15
      // jogada + 2 coletadas = 17).
      expect(jogadorHost.quantidadeCartas).toBe(15);
      expect(jogadorIA.quantidadeCartas).toBe(17);

      await host.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: IA da vez com Super Trunfo no topo -- atributo ignorado automaticamente, decidirAtributoIA NEM e chamada, E a Rodada resolve ate o fim sem crashar", async () => {
    embaralharOverride.atual = (cartas) => {
      // posicao0=IA (1a carta), posicao1=host (1a carta), posicao2=IA (2a
      // carta, novo topo apos vencer a Rodada 1) = "6D", a Super Trunfo.
      // posicao3=host (2a carta, novo topo apos perder a Rodada 1) = "8C"
      // -- forcada explicitamente pra NUNCA ser letra "A" (sem isso "resto"
      // cairia na proxima Carta em ordem de CSV, "1A", que anularia a
      // Super Trunfo por acidente e mudaria o resultado esperado do teste).
      const idsForcados = ["2B", "8B", "6D", "8C"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 1 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      const jogadorIA = room.state.jogadores.find((jogador) => jogador.isIA)!;
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      )!;
      expect(jogadorIA.monte[0]?.id).toBe("2B");
      expect(jogadorHost.monte[0]?.id).toBe("8B");

      // Truncamento de teste (mesmo padrao da Story 2.6): host fica so com
      // as proprias 2 Cartas forcadas ("8B" depois "8C") -- assim a Rodada
      // 2 (Super Trunfo sem oposicao) ja e suficiente pra zerar o Monte do
      // host e terminar a Partida, em vez de encadear rounds automaticos
      // indefinidamente enquanto a IA continuar vencendo (o host nunca
      // manda nada -- so o `send` inicial abaixo). Isso mantem o teste
      // determinístico e limitado sem depender de esperar a Partida inteira
      // se resolver organicamente.
      jogadorHost.monte = new ArraySchema<Carta>(...jogadorHost.monte.slice(0, 2));
      jogadorHost.quantidadeCartas = jogadorHost.monte.length;

      decidirAtributoIASpy.mockClear();

      // Host perde de proposito -- IA vira o Jogador da vez, com "6D" (a
      // Super Trunfo) ja no novo topo do proprio Monte.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // Encadeamento automatico pra "SuperTrunfoAcionado" (nunca
      // "Revelando" pra essa Carta, Boundaries "Always") -- sem nenhum 2o
      // `send`.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("SuperTrunfoAcionado");
        },
        { timeout: 5000, interval: 50 },
      );

      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(jogadorIA.sessionId);
      // `atributo` ignorado por completo -- nunca chega a ser preenchido
      // (Boundaries "Always" do spec).
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      // A prova central da Matrix: `decidirAtributoIA` nem chega a ser
      // chamada pro caminho de Super Trunfo -- o branch `ehSuperTrunfo` (ja
      // existente em `processarJogada`) decide isso ANTES, sem duplicar
      // logica nem precisar de uma decisao de Atributo que nunca seria usada.
      expect(decidirAtributoIASpy).not.toHaveBeenCalled();

      // Achado da revisao independente (blind-hunter): parar aqui, so em
      // "SuperTrunfoAcionado", deixava passar batido um crash real dentro
      // do proprio `resolverRodada` -- antes do `sessionId` sintetico por
      // assento de IA (Story 3.1, correcao aplicada em
      // `PartidaRoom.onCreate`/`aoReceberIniciarPartida`), TODA vaga de IA
      // compartilhava `sessionId === ""`, o MESMO valor que
      // `superTrunfoJogadoPor = remetente.sessionId` grava quando o
      // `remetente` e uma IA -- colidindo com o sentinela "nenhuma Super
      // Trunfo jogada" (`ehSuperTrunfo = superTrunfoJogadoPor !== ""`) e
      // fazendo `resolverRodada` cair no branch de Atributo normal com
      // `atributoSelecionado` ainda vazio, o que quebrava dentro de
      // `determinarVencedor` (`TypeError` no callback do
      // `clock.setTimeout`). Esperar a Rodada resolver ATE O FIM (nao so
      // confirmar a transicao pra "SuperTrunfoAcionado") e a unica forma de
      // pegar essa classe de regressao -- aqui ate `"FimDePartida"`, ja que
      // o truncamento acima faz esta MESMA Rodada (Super Trunfo sem
      // oposicao) zerar o Monte do host (Boundaries "Always" da Story 2.6:
      // Fim de Partida por coleta). Isso tambem prova que `resolverRodada`
      // NAO tenta despachar mais nenhuma jogada de IA depois que a Partida
      // termina (o branch `encerrarPartida()` retorna ANTES de chegar no
      // `if (vencedor.isIA)`).
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("FimDePartida");
        },
        { timeout: 5000, interval: 50 },
      );

      // Super Trunfo sem oposicao (host nao tem Carta letra "A" nesta
      // Rodada, "8C") -- a propria IA vence automaticamente, mesmo padrao
      // do teste equivalente humano (describe "Super Trunfo", Story 2.4).
      // `encerrarPartida()` limpa `rodadaAtual` inteira (Story 2.6).
      expect(room.state.rodadaAtual.jogadorDaVez).toBe("");
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe("");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(0);

      expect(room.state.ultimoResultado.vencedorNome).toBe(jogadorIA.nome);
      expect(room.state.ultimoResultado.tipoVitoria).toBe("superTrunfo");
      expect(room.state.ultimoResultado.atributo).toBe("");

      // IA jogou 2 Cartas no total ate aqui (2B na Rodada 1, 6D na Rodada
      // 2) e coletou as 2 de cada Rodada -- 16 -1 +2 -1 +2 = 18. Host
      // (truncado pra 2 Cartas antes da Rodada 1) perdeu as 2 -- eliminado,
      // Fim de Partida.
      expect(jogadorIA.quantidadeCartas).toBe(18);
      expect(jogadorHost.quantidadeCartas).toBe(0);

      await host.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: IAs consecutivas -- os 2 unicos Jogadores ativos restantes sao IA, as jogadas encadeiam automaticamente sem NENHUM Client enviar jogarCarta, e o vencedor CERTO e creditado", async () => {
    // jogadores order = [IA1, IA2 (onCreate), host, convidado (onJoin)].
    // Round-robin de `distribuir`: posicao%4 -> 0=IA1,1=IA2,2=host,3=convidado.
    // Rodada 1 (4 ativos): IA1 vence (7B=484, o maior); host/convidado (1
    // Carta cada, truncados abaixo) ficam eliminados; IA2 so perde 1 Carta.
    // Rodada 2 (so IA1 x IA2, automatica): IA2 vence (1A=325 > 3D=306) --
    // deliberadamente a SEGUNDA IA listada, nunca a primeira, pra provar
    // que o vencedor e creditado pelo valor REAL da Carta, nao por quem
    // aparece primeiro em `state.jogadores` (Story 3.1, correcao do
    // `sessionId` sintetico unico por assento de IA em
    // `PartidaRoom.onCreate`/`aoReceberIniciarPartida` -- achado da revisao
    // independente: antes dessa correcao, TODA vaga de IA compartilhava
    // `sessionId === ""`, e `resolverRodada` sempre reatribuia o vencedor
    // de uma Rodada 100% IA-vs-IA pra IA1, a primeira `sessionId === ""`
    // em `state.jogadores`, INDEPENDENTE de quem realmente tinha o maior
    // valor). Rodada 3 (so IA1 x IA2, automatica de novo): so precisa
    // COMECAR (nao resolve dentro do teste) -- prova o encadeamento de
    // verdade, nao so um unico salto isolado.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["7B", "2B", "8B", "6D", "3D", "1A", "5B", "5C", "4B", "5D"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    // Forca decidirAtributoIA a sempre escolher "velocidadeMaxima"
    // (ATRIBUTOS[0]) nas Rodadas 2/3 -- deterministico o suficiente pra
    // prever os 2 encadeamentos automaticos sem depender de sorte.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 2 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId); // host = sempre o Jogador Inicial

      const jIA1 = room.state.jogadores.find((jogador) => jogador.isIA && jogador.nome === "IA 1")!;
      const jIA2 = room.state.jogadores.find((jogador) => jogador.isIA && jogador.nome === "IA 2")!;
      const jHost = room.state.jogadores.find((jogador) => jogador.sessionId === host.sessionId)!;
      const jConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;

      // Premissa do teste: confirma os 4 topos forcados da Rodada 1.
      expect(jIA1.monte[0]?.id).toBe("7B");
      expect(jIA2.monte[0]?.id).toBe("2B");
      expect(jHost.monte[0]?.id).toBe("8B");
      expect(jConvidado.monte[0]?.id).toBe("6D");

      // Story 3.1 (correcao): as 2 vagas de IA tem `sessionId` sintetico
      // UNICO, nunca compartilhado -- premissa que o resto deste teste
      // depende pra distinguir de verdade quem venceu cada Rodada 100%
      // IA-vs-IA abaixo.
      expect(jIA1.sessionId).not.toBe("");
      expect(jIA2.sessionId).not.toBe("");
      expect(jIA1.sessionId).not.toBe(jIA2.sessionId);

      // Truncamento de teste (mesmo padrao da Story 2.6): host/convidado
      // ficam com so a propria Carta forcada -- uma UNICA Rodada decisiva
      // ja basta pra eliminar os 2, sem depender do resto do Baralho.
      jHost.monte = new ArraySchema<Carta>(jHost.monte[0]);
      jHost.quantidadeCartas = jHost.monte.length;
      jConvidado.monte = new ArraySchema<Carta>(jConvidado.monte[0]);
      jConvidado.quantidadeCartas = jConvidado.monte.length;

      // Unica mensagem enviada por QUALQUER Client em todo o teste.
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      // Rodada 1 resolve (IA1 vence, host/convidado eliminados) e -- na
      // MESMA execucao sincrona -- encadeia pra Rodada 2 (so IA1 x IA2)
      // automaticamente. Espera pela contagem final de Cartas da Rodada 2
      // -- por essa altura, a Rodada 3 ja comecou tambem (mesmo
      // encadeamento sincrono). IA2 vence a Rodada 2 pelo valor REAL da
      // Carta (1A=325 > 3D=306) e e creditada corretamente: IA2 (7 - 1
      // propria jogada + 2 coletadas = 8); IA1 so perde a propria (11 - 1 =
      // 10) -- a prova central deste teste: com `sessionId` unico por
      // assento de IA, o vencedor certo (a SEGUNDA IA listada) e creditado,
      // nunca sempre a primeira. Espera pelo valor de IA1 (10), NUNCA o de
      // IA2 (8) -- achado da 1a tentativa deste teste: IA2 comeca a
      // distribuicao inicial com exatamente 8 Cartas (32/4), entao esperar
      // por "IA2 === 8" seria trivialmente verdadeiro ANTES de qualquer
      // Rodada ser jogada, sem esperar nada de verdade. O valor de IA1 (10)
      // so e alcancavel DEPOIS que as Rodadas 1 e 2 realmente resolverem.
      await vi.waitFor(
        () => {
          expect(jIA1.quantidadeCartas).toBe(10);
        },
        { timeout: 6000, interval: 50 },
      );

      // Host/convidado eliminados pela Rodada 1 -- nunca ressuscitados
      // pelas Rodadas seguintes entre as IAs.
      expect(jHost.quantidadeCartas).toBe(0);
      expect(jConvidado.quantidadeCartas).toBe(0);
      // So as 2 IAs continuam ativas.
      const ativos = room.state.jogadores.filter((jogador) => jogador.monte.length > 0);
      expect(ativos.map((jogador) => jogador.sessionId).sort()).toEqual(
        [jIA1.sessionId, jIA2.sessionId].sort(),
      );

      // IA2 (vencedora de verdade da Rodada 2) recebeu as 2 Cartas jogadas
      // -- confirma o outro lado da conta ja esperada acima (IA1 === 10).
      expect(jIA2.quantidadeCartas).toBe(8);

      // Rodada 3 (so IA1 x IA2) ja comecou automaticamente -- prova o
      // SEGUNDO encadeamento (nao so um unico salto isolado). `atributo`
      // segue "velocidadeMaxima" (Math.random mockado), `cartasEmDisputa`
      // tem exatamente os 2 Jogadores ativos. `jogadorDaVez` aponta
      // corretamente pra IA2 (a vencedora de verdade da Rodada 2) --
      // distinguivel de IA1 agora que cada assento de IA tem `sessionId`
      // proprio.
      expect(room.state.estado).toBe("Revelando");
      expect(room.state.rodadaAtual.atributoSelecionado).toBe("velocidadeMaxima");
      expect(room.state.rodadaAtual.cartasEmDisputa).toHaveLength(2);
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(jIA2.sessionId);
      expect(room.state.rodadaAtual.jogadorDaVez).not.toBe(jIA1.sessionId);

      // decidirAtributoIA disparou exatamente 2 vezes (dispatch da Rodada 2
      // e da Rodada 3), nunca precisando de nenhum Client enviar
      // `jogarCarta` alem do unico `send` inicial do host.
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(2);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
      randomSpy.mockRestore();
    }
  }, 20000);
});

/**
 * Camada de integracao de Room (AD-12) da Story 3.2: cobre a Matrix inteira
 * de `onLeave` bifurcado -- desconexao fora da propria vez, na propria vez
 * (dispara `despacharJogadaDeIA` imediatamente), durante a pausa de
 * revelacao (nada dispara agora, `resolverRodada` acha o Jogador
 * normalmente quando a pausa terminar), tentativa de retorno do Jogador
 * original (rejeitada, `this.lock()` ja ativo desde `iniciarPartida`), e a
 * regressao da Sala de Espera (Story 1.4, ainda remove).
 */
describe("PartidaRoom -- Continuidade por Desconexao (Story 3.2)", () => {
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

  it("Matrix: desconexao fora da propria vez -- assento vira IA sem interromper a Partida, joga automaticamente quando chegar a vez dele", async () => {
    // Round-robin de 2 jogadores: pos0/2 = host, pos1/3 = convidado.
    // host=8B(250km/h) x convidado=2B(440km/h) -- host perde de proposito
    // na Rodada 1; novo topo do convidado na Rodada 2 = 3D (nao Super
    // Trunfo, pra decidirAtributoIA disparar sem crash).
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["8B", "2B", "8C", "3D"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);

      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;
      const convidadoSessionId = convidado.sessionId;
      const quantidadeAntes = jogadorConvidado.quantidadeCartas;

      // Convidado desconecta -- NAO e a vez dele (jogadorDaVez = host).
      await convidado.leave();

      await vi.waitFor(() => {
        expect(jogadorConvidado.isIA).toBe(true);
      });

      // Nada dispara agora -- a Rodada continua parada esperando o host,
      // sem interrupcao nenhuma pro Jogador que ficou.
      expect(room.state.estado).toBe("AguardandoSelecao");
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(host.sessionId);
      // Assento NUNCA removido -- mesmo sessionId antigo, mesmo Monte.
      expect(room.state.jogadores).toHaveLength(2);
      expect(jogadorConvidado.sessionId).toBe(convidadoSessionId);
      expect(jogadorConvidado.quantidadeCartas).toBe(quantidadeAntes);

      decidirAtributoIASpy.mockClear();

      // Host joga e perde de proposito -- o assento convertido em IA vira o
      // Jogador da vez e precisa jogar SOZINHO, sem nenhum Client mandar
      // nada por ele (a sessao real ja caiu).
      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      await vi.waitFor(
        () => {
          expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidadoSessionId);
        },
        { timeout: 5000, interval: 50 },
      );

      // A jogada automatica ja disparou (Rodada 2 ja em andamento) na MESMA
      // execucao sincrona que resolveu a Rodada 1 (AD-4/Story 3.1).
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(1);
      expect(room.state.estado).toBe("Revelando");

      // Host perdeu a Rodada 1 (16 -> 15); convidado (IA) venceu e coletou
      // (16 -> 15 jogada + 2 coletadas = 17).
      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      )!;
      expect(jogadorHost.quantidadeCartas).toBe(15);
      expect(jogadorConvidado.quantidadeCartas).toBe(17);

      await host.leave();
    } finally {
      embaralharOverride.atual = null;
      randomSpy.mockRestore();
    }
  }, 15000);

  it("Matrix: desconexao na propria vez -- assento vira IA E a jogada dispara imediatamente, sem travar a Rodada", async () => {
    // Nenhuma das 2 Cartas forcadas e a Super Trunfo -- so precisa evitar o
    // ramo Super Trunfo pra este teste focar no disparo imediato em si.
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["8B", "8C"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });
      const hostSessionId = host.sessionId;
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(hostSessionId);

      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === hostSessionId,
      )!;

      decidirAtributoIASpy.mockClear();

      // Host desconecta SEM jogar -- era a propria vez dele
      // (`estado === "AguardandoSelecao"` e `jogadorDaVez === host`).
      await host.leave();

      await vi.waitFor(() => {
        expect(jogadorHost.isIA).toBe(true);
      });

      // A jogada dispara IMEDIATAMENTE (dentro do proprio `onLeave`) --
      // ninguem mais envia `jogarCarta` neste teste (so o convidado
      // continua conectado, e nunca manda nada).
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(1);
      expect(room.state.rodadaAtual.jogadorDaVez).toBe(hostSessionId);
      expect(room.state.jogadores).toHaveLength(2);

      // A pausa termina e a Rodada resolve normalmente -- nunca fica
      // travada esperando por um `jogarCarta` que nunca chegaria.
      await vi.waitFor(
        () => {
          expect(room.state.estado).toBe("AguardandoSelecao");
        },
        { timeout: 5000, interval: 50 },
      );
      expect(room.state.jogadores).toHaveLength(2);

      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  }, 15000);

  it("Matrix: desconexao durante a pausa de revelacao -- assento vira IA mas nada dispara agora; resolverRodada resolve normalmente com a Carta ja jogada", async () => {
    // host=8B(250km/h) x convidado=2B(440km/h) -- convidado vence a Rodada
    // 1; novo topo do convidado na Rodada 2 = 3D (nao Super Trunfo).
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["8B", "2B", "8C", "3D"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      host.send("jogarCarta", { atributo: "velocidadeMaxima" });
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("Revelando");
      });

      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;
      const convidadoSessionId = convidado.sessionId;

      decidirAtributoIASpy.mockClear();

      // Convidado JA JOGOU nesta Rodada (Carta capturada, revelacao em
      // andamento) -- desconecta durante a pausa de "Revelando".
      await convidado.leave();

      await vi.waitFor(() => {
        expect(jogadorConvidado.isIA).toBe(true);
      });

      // Nada dispara agora -- `estado` nao e "AguardandoSelecao", so o
      // assento vira IA, sem mais nenhum efeito imediato.
      expect(room.state.estado).toBe("Revelando");
      expect(decidirAtributoIASpy).not.toHaveBeenCalled();

      // A pausa termina -- resolverRodada acha o Jogador normalmente
      // (nunca mais some de state.jogadores) e credita o vencedor certo,
      // mesmo com a sessao real ja caida.
      await vi.waitFor(
        () => {
          expect(room.state.rodadaAtual.jogadorDaVez).toBe(convidadoSessionId);
        },
        { timeout: 5000, interval: 50 },
      );

      // Convidado (agora IA) venceu -- como e a vez dele agora, a Rodada 2
      // ja dispara automaticamente tambem (continuidade sem interrupcao,
      // Design Notes do spec).
      expect(room.state.estado).toBe("Revelando");
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(1);

      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      )!;
      expect(jogadorHost.quantidadeCartas).toBe(15);
      expect(jogadorConvidado.quantidadeCartas).toBe(17);

      await host.leave();
    } finally {
      embaralharOverride.atual = null;
      randomSpy.mockRestore();
    }
  }, 15000);

  /**
   * Achado da revisao independente (edge-case-hunter): a Matrix da Story
   * 3.2 acima ("desconexao durante a pausa de revelacao") so exercitava a
   * variante normal de Atributo (`estado === "Revelando"`) -- a mesma
   * linha da I/O Matrix do spec tambem cobre `"SuperTrunfoAcionado"`
   * explicitamente, mas nenhum teste ainda forcava a Super Trunfo pro topo
   * antes de desconectar. `resolverRodada` tem um guard PROPRIO pro
   * branch de Super Trunfo (`indiceDoSuperTrunfo === -1`, PartidaRoom.ts)
   * que, antes da Story 3.2, podia disparar de verdade se o proprio
   * Jogador do Super Trunfo desconectasse durante a pausa (`onLeave`
   * removia incondicionalmente). Este teste prova que esse guard fica
   * estruturalmente inalcancavel por este caminho: o Jogador que jogou a
   * Super Trunfo desconecta durante "SuperTrunfoAcionado", vira IA, e
   * `resolverRodada` credita a vitoria dele normalmente quando a pausa
   * terminar -- nunca cai no abort defensivo.
   */
  it("Matrix: desconexao durante a pausa de SuperTrunfoAcionado -- assento vira IA mas nada dispara agora; resolverRodada resolve o branch de Super Trunfo normalmente (guard indiceDoSuperTrunfo nunca dispara)", async () => {
    // host=6D (Super Trunfo) x convidado=2B (letra B, sem oposicao) --
    // novo topo do host na Rodada 2 = 8C (nao Super Trunfo).
    embaralharOverride.atual = (cartas) => {
      const idsForcados = ["6D", "2B", "8C"];
      const forcadas = idsForcados.map((id) => cartas.find((carta) => carta.id === id)!);
      const resto = cartas.filter((carta) => !idsForcados.includes(carta.id));
      return [...forcadas, ...resto];
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const warnSpy = vi.spyOn(console, "warn");

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      const jogadorHost = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      )!;
      expect(jogadorHost.monte[0]?.id).toBe("6D");
      const hostSessionId = host.sessionId;

      // Host joga a propria Super Trunfo -- `atributo` nem se aplica
      // (Story 2.4).
      host.send("jogarCarta", {});
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("SuperTrunfoAcionado");
      });
      expect(room.state.rodadaAtual.superTrunfoJogadoPor).toBe(hostSessionId);

      decidirAtributoIASpy.mockClear();
      warnSpy.mockClear();

      // O proprio Jogador do Super Trunfo (host) desconecta durante a
      // pausa de "SuperTrunfoAcionado" -- `onLeave` (Story 3.2) converte
      // pra IA em vez de remover.
      await host.leave();

      await vi.waitFor(() => {
        expect(jogadorHost.isIA).toBe(true);
      });
      // Nunca removido -- os 2 assentos continuam em state.jogadores.
      expect(room.state.jogadores).toHaveLength(2);

      // Nada dispara agora -- `estado` nao e "AguardandoSelecao", so o
      // assento vira IA, sem mais nenhum efeito imediato.
      expect(room.state.estado).toBe("SuperTrunfoAcionado");
      expect(decidirAtributoIASpy).not.toHaveBeenCalled();

      // A pausa termina -- resolverRodada acha o Jogador do Super Trunfo
      // normalmente (`indiceDoSuperTrunfo` NUNCA fica -1 por este
      // caminho) e credita a vitoria dele, mesmo com a sessao real ja
      // caida. Espera pela contagem final de Cartas do host (17), NUNCA
      // por `jogadorDaVez === hostSessionId` -- host ja E o Jogador
      // Inicial desde `iniciarPartida` e `jogadorDaVez` nunca muda
      // enquanto a Rodada esta em "SuperTrunfoAcionado", entao essa
      // condicao seria trivialmente verdadeira ANTES da Rodada resolver de
      // verdade (mesmo achado ja documentado no describe "IA", Story 3.1,
      // pro valor de IA1).
      await vi.waitFor(
        () => {
          expect(jogadorHost.quantidadeCartas).toBe(17);
        },
        { timeout: 5000, interval: 50 },
      );

      // O guard defensivo `indiceDoSuperTrunfo === -1` NUNCA disparou --
      // nenhum `console.warn` de abort foi logado (a unica forma de
      // `resolverRodada` retornar cedo nesse branch).
      expect(warnSpy).not.toHaveBeenCalled();

      // Host (agora IA) venceu sem oposicao -- como e a vez dele agora, a
      // Rodada 2 ja dispara automaticamente tambem (continuidade sem
      // interrupcao, Design Notes do spec).
      expect(room.state.estado).toBe("Revelando");
      expect(decidirAtributoIASpy).toHaveBeenCalledTimes(1);

      // Coleta normal: host jogou 1 Carta (16 -> 15) e coletou as 2
      // jogadas na Rodada (propria Super Trunfo + a do convidado, 15 + 2 =
      // 17); convidado so perdeu a sua (16 -> 15).
      const jogadorConvidado = room.state.jogadores.find(
        (jogador) => jogador.sessionId === convidado.sessionId,
      )!;
      expect(jogadorHost.quantidadeCartas).toBe(17);
      expect(jogadorConvidado.quantidadeCartas).toBe(15);
      expect(room.state.ultimoResultado.tipoVitoria).toBe("superTrunfo");

      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
      randomSpy.mockRestore();
      warnSpy.mockRestore();
    }
  }, 15000);

  it("Matrix: Jogador original tenta voltar apos o assento virar IA -- joinById rejeitado (Room ja trancada desde iniciarPartida)", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    host.send("iniciarPartida");
    await vi.waitFor(() => {
      expect(room.state.estado).toBe("AguardandoSelecao");
    });
    expect(room.locked).toBe(true);

    const jogadorConvidado = room.state.jogadores.find(
      (jogador) => jogador.sessionId === convidado.sessionId,
    )!;

    await convidado.leave();
    await vi.waitFor(() => {
      expect(jogadorConvidado.isIA).toBe(true);
    });

    // Reabre o link de convite pra esta mesma Partida -- rejeitado, mesmo
    // comportamento ja existente de sala trancada/cheia (Boundaries
    // "Never": sem mecanismo de reconexao, AD-9 ja fechada).
    await expect(testServer.connectTo(room, { nome: "Rafael" })).rejects.toThrow(/locked/i);

    // O assento continua IA -- ninguem novo retomou o lugar dele.
    expect(room.state.jogadores).toHaveLength(2);
    expect(jogadorConvidado.isIA).toBe(true);

    await host.leave();
  });

  it("Matrix (regressao): desconexao na Sala de Espera -- Story 1.4 inalterada, Jogador removido de state.jogadores, nunca vira IA", async () => {
    const room = await testServer.createRoom("partida", { totalJogadores: 4, totalIA: 0 });
    const host = await testServer.connectTo(room, { nome: "Mauricio" });
    const convidado = await testServer.connectTo(room, { nome: "Rafael" });

    expect(room.state.estado).toBe("AguardandoJogadores");
    expect(room.state.jogadores).toHaveLength(2);

    await convidado.leave();

    await vi.waitFor(() => {
      expect(room.state.jogadores).toHaveLength(1);
    });
    expect(room.state.jogadores[0].sessionId).toBe(host.sessionId);
    // Nenhum resquicio do convidado sobra convertido em IA -- realmente
    // removido, mesmo comportamento da Story 1.4.
    expect(room.state.jogadores.every((jogador) => !jogador.isIA)).toBe(true);

    await host.leave();
  });
});

/**
 * Camada de integracao de Room (AD-12) da Story 5.6: prova que a mudanca de
 * `@type("number")` pra `@type("float64")` em `Carta.aceleracao`
 * (`backend/src/schema/Carta.ts`) realmente fecha o bug de precisao pela
 * REDE de verdade -- nenhum teste anterior da suite passa `aceleracao` pelo
 * encoder/decoder real do Colyseus (so por instancias de Schema no proprio
 * processo do servidor, `comparacao.test.ts`/`baralho.test.ts`), entao
 * nenhum deles teria acusado o artefato de float32 (`3.200000047683716`)
 * que so aparece depois de ida-e-volta pela rede real via
 * `@colyseus/testing`.
 */
describe("PartidaRoom -- precisao numerica de aceleracao (Story 5.6)", () => {
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

  it("Carta '1A' (aceleracao 3.2 no CSV) decodifica exatamente 3.2 no estado do CLIENTE, sem artefato de ponto flutuante", async () => {
    // Forca a "1A" (Mercedes-AMG GT Black Series, aceleracao 3.2 no CSV --
    // mesmo exemplo citado no Problem/AC da spec) pro topo do Monte do
    // host -- `distribuir` faz round-robin a partir do indice 0, e
    // `jogadores[0]` e' sempre o host (primeiro humano a entrar), entao
    // `baralhoEmbaralhado[0]` vira exatamente o topo do Monte dele.
    embaralharOverride.atual = (cartas) => {
      const alvo = cartas.find((carta) => carta.id === "1A")!;
      const resto = cartas.filter((carta) => carta.id !== "1A");
      return [alvo, ...resto];
    };

    try {
      const room = await testServer.createRoom("partida", { totalJogadores: 2, totalIA: 0 });
      const host = await testServer.connectTo(room, { nome: "Mauricio" });
      const convidado = await testServer.connectTo(room, { nome: "Rafael" });

      host.send("iniciarPartida");
      await vi.waitFor(() => {
        expect(room.state.estado).toBe("AguardandoSelecao");
      });

      // Confirma a premissa no proprio servidor antes de testar o cliente.
      const jogadorHostNoServidor = room.state.jogadores.find(
        (jogador) => jogador.sessionId === host.sessionId,
      );
      expect(jogadorHostNoServidor?.monte[0]?.id).toBe("1A");
      expect(jogadorHostNoServidor?.monte[0]?.aceleracao).toBe(3.2);

      // Espera o patch de StateView (a distribuicao inteira) propagar pro
      // estado local decodificado do cliente antes de inspecionar -- e'
      // exatamente essa travessia servidor->rede->cliente (encoder real do
      // Colyseus) que reproduzia o artefato de float32 antes do fix. Poll
      // pela condicao real (Carta decodificada) em vez de um sleep fixo,
      // que sob carga do CI poderia nao ser suficiente.
      await vi.waitFor(() => {
        const jogador = host.state.jogadores.find(
          (j: { sessionId: string }) => j.sessionId === host.sessionId,
        ) as { monte?: { id: string; aceleracao: number }[] } | undefined;
        expect(jogador?.monte?.[0]?.aceleracao).toBeDefined();
      });

      const meuJogadorNoHost = host.state.jogadores.find(
        (jogador: { sessionId: string }) => jogador.sessionId === host.sessionId,
      ) as { monte?: { id: string; aceleracao: number }[] } | undefined;

      expect(meuJogadorNoHost?.monte?.[0]?.id).toBe("1A");
      // Prova direta do fix: `toBe(3.2)` exato, nunca aproximado (ex:
      // `3.200000047683716`, o artefato de float32 documentado na spec).
      expect(meuJogadorNoHost?.monte?.[0]?.aceleracao).toBe(3.2);

      await host.leave();
      await convidado.leave();
    } finally {
      embaralharOverride.atual = null;
    }
  });
});
