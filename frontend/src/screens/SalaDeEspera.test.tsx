import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Room } from "@colyseus/sdk";
import { SalaDeEspera } from "./SalaDeEspera.tsx";
import { iniciarPartida } from "../client/colyseusClient.ts";

vi.mock("../client/colyseusClient.ts", () => ({
  iniciarPartida: vi.fn(),
}));

// `globals: false` no vitest.config.ts -- sem cleanup automatico entre
// testes, entao desmonta explicitamente pra nao acumular renders no DOM.
afterEach(() => {
  cleanup();
});

interface JogadorFalso {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
}

/**
 * Monta um `Room` falso o suficiente pro `SalaDeEspera` renderizar: precisa
 * de `state` (jogadores + totais), `sessionId` (pra achar "meu" Jogador) e
 * `onStateChange` (signal do Colyseus, com `.remove` -- ver efeito do
 * componente que assina/desassina o listener). `onLeave`/`onError` (Story
 * 7.2) sao signals fake no mesmo padrao, pros novos testes de conexao
 * perdida conseguirem disparar o callback que o componente assinou.
 */
function criarRoomFalso(jogadores: JogadorFalso[], meuSessionId: string): Room {
  const onStateChange = Object.assign(vi.fn(), { remove: vi.fn() });
  const onLeave = Object.assign(vi.fn(), { remove: vi.fn() });
  const onError = Object.assign(vi.fn(), { remove: vi.fn() });
  return {
    roomId: "sala-123",
    sessionId: meuSessionId,
    state: {
      jogadores,
      totalJogadoresDeclarado: 4,
      totalIADeclarado: 0,
    },
    onStateChange,
    onLeave,
    onError,
    send: vi.fn(),
  } as unknown as Room;
}

/**
 * Camada de componente (AD-12) da Sala de Espera -- Story 1.4. Cobre as
 * linhas "Iniciar habilita com 2"/"Iniciar desabilitado com 1"/"Convidado
 * não vê Iniciar"/"Clique em Iniciar" da Matrix.
 */
describe("SalaDeEspera -- camada de componente (AD-12)", () => {
  it("nao renderiza o botao Iniciar pra quem nao e host (Matrix: Convidado nao ve Iniciar)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false },
      ],
      "convidado-1",
    );

    render(<SalaDeEspera room={room} />);

    expect(screen.queryByRole("button", { name: "Iniciar" })).not.toBeInTheDocument();
  });

  it("mantem o botao Iniciar desabilitado pro host com so 1 jogador (Matrix: Iniciar desabilitado com 1)", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    expect(screen.getByRole("button", { name: "Iniciar" })).toBeDisabled();
  });

  it("habilita o botao Iniciar pro host assim que jogadores.length chega a 2 (Matrix: Iniciar habilita com 2)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "", nome: "IA 1", isHost: false, isIA: true },
      ],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    expect(screen.getByRole("button", { name: "Iniciar" })).toBeEnabled();
  });

  it("dispara iniciarPartida(room) ao clicar em Iniciar habilitado (Matrix: Clique em Iniciar)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false },
      ],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));

    expect(iniciarPartida).toHaveBeenCalledWith(room);
  });

  it("habilita o botao Iniciar em tempo real quando o segundo jogador entra via onStateChange (reatividade real, nao so snapshot)", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeDisabled();

    // Captura o callback que o componente passou pro `room.onStateChange`
    // (signal do Colyseus) -- mesmo caminho que o backend usaria pra
    // notificar o cliente de uma mudanca real de estado.
    const aoMudarEstado = vi.mocked(room.onStateChange).mock.calls[0][0] as () => void;

    // Colyseus decodifica patches mutando a mesma instancia de `room.state`
    // em vez de trocar a referencia (ver comentario do componente) -- por
    // isso o teste muta o array em vez de reatribuir `room.state`.
    (room.state as { jogadores: JogadorFalso[] }).jogadores.push({
      sessionId: "ia-1",
      nome: "IA 1",
      isHost: false,
      isIA: true,
    });

    act(() => {
      aoMudarEstado();
    });

    expect(screen.getByRole("button", { name: "Iniciar" })).toBeEnabled();
  });
});

/**
 * Botao "Copiar link" -- Story 5.3. Cobre a I/O & Edge-Case Matrix: copia
 * bem-sucedida com confirmacao visual temporaria, falha da Clipboard API
 * sem quebrar a tela, e cliques repetidos sem timers conflitantes.
 */
describe("SalaDeEspera -- compartilhar link da sala (Story 5.3)", () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "clipboard");
    vi.useRealTimers();
  });

  function definirClipboardFalso(writeText: ReturnType<typeof vi.fn>) {
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  }

  it("copia o link exibido e mostra confirmacao temporaria que reverte sozinha (Matrix: cópia bem-sucedida)", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    definirClipboardFalso(writeText);
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);
    const linkEsperado = `${window.location.origin}/sala/${room.roomId}`;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(linkEsperado);
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("nao quebra a tela quando a Clipboard API rejeita, e loga o erro sem travar em 'Copiado!' (Matrix: Clipboard API indisponível ou rejeita)", async () => {
    const erroClipboard = new Error("clipboard indisponivel");
    const writeText = vi.fn().mockRejectedValue(erroClipboard);
    definirClipboardFalso(writeText);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiado!" })).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("nao quebra a tela quando navigator.clipboard esta indisponivel (undefined)", async () => {
    // `navigator.clipboard` nao definido nesse ambiente (jsdom) por padrao
    // -- garante que nenhum defineProperty anterior vazou entre testes.
    Reflect.deleteProperty(window.navigator, "clipboard");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("cliques repetidos nao geram timers conflitantes -- o timer antigo nao reverte o texto depois de um clique novo (Matrix: cliques repetidos rápidos)", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    definirClipboardFalso(writeText);
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    // Avanca 1000ms (metade do timeout) e clica de novo -- se o timer do
    // primeiro clique nao for limpo, ele dispararia em +1000ms a partir daqui
    // (2000ms desde o primeiro clique) e reverteria o texto cedo demais.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiado!" }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 2000ms desde o PRIMEIRO clique, mas so 1000ms desde o segundo -- ainda
    // deve estar "Copiado!" (timer antigo foi limpo no segundo clique).
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 2000ms desde o SEGUNDO clique -- agora sim reverte.
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("ignora um segundo clique enquanto o primeiro writeText ainda esta em voo (corrida de clique duplo sobreposto)", async () => {
    vi.useFakeTimers();
    // `writeText` so resolve quando `resolverPrimeiraCopia` for chamado --
    // simula a Promise da primeira copia ainda pendente quando o segundo
    // clique chega, o cenario da corrida (duas resolucoes sobrepostas cada
    // uma agendando seu proprio timer, a segunda pisando na referencia da
    // primeira).
    let resolverPrimeiraCopia: (() => void) | undefined;
    const writeText = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolverPrimeiraCopia = resolve;
        }),
    );
    definirClipboardFalso(writeText);
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    // Dois cliques sincronos, antes de qualquer `await` -- a primeira
    // chamada de `writeText` ainda esta pendente quando o segundo clique
    // dispara o handler de novo.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    });

    // O segundo clique deve ser um no-op: so a primeira chamada de
    // `writeText` chegou a acontecer.
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolverPrimeiraCopia?.();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();
    // Ainda so uma chamada -- o segundo clique nunca chegou a chamar
    // `writeText`.
    expect(writeText).toHaveBeenCalledTimes(1);

    // So um timer foi agendado (nao ha timer orfao de uma segunda
    // resolucao) -- 2000ms depois da unica copia, reverte normalmente.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });
});

/**
 * Aviso de conexao perdida (Story 7.2) -- cobre a I/O & Edge-Case Matrix:
 * `onLeave` (host e convidado, textos diferentes), `onError` (mesmo aviso
 * generico) e a regressao de tela normal sem nenhum disparo.
 */
describe("SalaDeEspera -- aviso de conexao perdida (Story 7.2)", () => {
  it("mostra o aviso orientando recriar a sala quando onLeave dispara pro host (Matrix: conexao do host cai de vez)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false },
      ],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    const aoPerderConexao = vi.mocked(room.onLeave).mock.calls[0][0] as (
      code: number,
      reason?: string,
    ) => void;

    act(() => {
      aoPerderConexao(4000, "reconexao esgotada");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Sua conexão com a sala caiu.");
    expect(screen.getByText("Crie uma nova sala pra continuar.")).toBeInTheDocument();
    // A tela normal da Sala de Espera precisa sumir por completo -- nao so
    // o aviso aparecer por cima dela.
    expect(screen.queryByRole("button", { name: "Iniciar" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-convite")).not.toBeInTheDocument();
  });

  it("mostra o aviso orientando reabrir o link quando onLeave dispara pro convidado (Matrix: conexao do convidado cai de vez)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false },
      ],
      "convidado-1",
    );

    render(<SalaDeEspera room={room} />);

    const aoPerderConexao = vi.mocked(room.onLeave).mock.calls[0][0] as (
      code: number,
      reason?: string,
    ) => void;

    act(() => {
      aoPerderConexao(4000, "reconexao esgotada");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Sua conexão com a sala caiu.");
    expect(
      screen.getByText("Reabra o link de convite pra tentar entrar de novo."),
    ).toBeInTheDocument();
  });

  it("mostra o mesmo aviso quando onError dispara (Matrix: erro de conexao)", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    const aoPerderConexao = vi.mocked(room.onError).mock.calls[0][0] as (
      code: number,
      message?: string,
    ) => void;

    act(() => {
      aoPerderConexao(1006, "erro de conexao");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Sua conexão com a sala caiu.");
  });

  it("continua mostrando a tela normal sem nenhum aviso quando onLeave/onError nao disparam (regressao)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false },
      ],
      "host-1",
    );

    render(<SalaDeEspera room={room} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Sala de Espera")).toBeInTheDocument();
  });

  it("mostra o aviso de conexao perdida em vez de 'Carregando sala...' quando onLeave dispara antes do snapshot de jogadores chegar (conexaoPerdida tem prioridade sobre o guard de Carregando)", () => {
    // `jogadores` vazio (nenhum snapshot chegou ainda) -- e exatamente por
    // isso que `meuJogador`/`souHost` precisaram subir pra antes do guard de
    // "Carregando" (Story 7.2): sem essa hoiste, este cenario travaria
    // mostrando "Carregando sala..." pra sempre, mesmo com a conexao ja
    // caida de vez. So verifica o titulo do aviso -- o texto especifico de
    // host/convidado com `jogadores` vazio e uma limitacao conhecida a
    // parte (deferred-work.md), fora do escopo deste teste.
    const room = criarRoomFalso([], "host-1");

    render(<SalaDeEspera room={room} />);
    expect(screen.getByText("Carregando sala…")).toBeInTheDocument();

    const aoPerderConexao = vi.mocked(room.onLeave).mock.calls[0][0] as (
      code: number,
      reason?: string,
    ) => void;

    act(() => {
      aoPerderConexao(4000, "reconexao esgotada");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Sua conexão com a sala caiu.");
    expect(screen.queryByText("Carregando sala…")).not.toBeInTheDocument();
  });

  it("remove os listeners onLeave/onError do room ao desmontar (mesmo padrao de cleanup do timer de copia, Story 5.3)", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false }],
      "host-1",
    );

    const { unmount } = render(<SalaDeEspera room={room} />);

    const aoPerderConexaoViaOnLeave = vi.mocked(room.onLeave).mock.calls[0][0];
    const aoPerderConexaoViaOnError = vi.mocked(room.onError).mock.calls[0][0];

    unmount();

    expect(room.onLeave.remove).toHaveBeenCalledWith(aoPerderConexaoViaOnLeave);
    expect(room.onError.remove).toHaveBeenCalledWith(aoPerderConexaoViaOnError);
  });
});
