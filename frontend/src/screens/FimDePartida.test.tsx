import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Room } from "@colyseus/sdk";
import { FimDePartida } from "./FimDePartida.tsx";

afterEach(() => {
  cleanup();
});

interface JogadorFalso {
  sessionId: string;
  nome: string;
  quantidadeCartas: number;
}

/** Monta um `Room` falso -- mesmo espirito de `MesaDeJogo.test.tsx`. */
function criarRoomFalso(jogadores: JogadorFalso[]): Room {
  const onStateChange = Object.assign(vi.fn(), { remove: vi.fn() });
  return {
    roomId: "sala-123",
    sessionId: "host-1",
    state: {
      jogadores,
    },
    onStateChange,
  } as unknown as Room;
}

/**
 * Camada de componente (AD-12) do Fim de Partida -- Story 2.6. Cobre o
 * Code Map: Banner de Vitoria ("{vencedor} venceu a partida!" + "Reuniu as
 * N cartas do baralho", N nunca hardcoded 32), lista de todos os
 * Jogadores com `quantidadeCartas`, e o botao "Jogar Novamente".
 */
describe("FimDePartida -- camada de componente (AD-12)", () => {
  it("mostra o Banner de Vitoria com o nome do vencedor e a contagem REAL de Cartas dele (nunca hardcoded 32)", () => {
    const room = criarRoomFalso([
      { sessionId: "host-1", nome: "Mauricio", quantidadeCartas: 20 },
      { sessionId: "convidado-1", nome: "Rafael", quantidadeCartas: 0 },
    ]);

    render(<FimDePartida room={room} />);

    const banner = screen.getByTestId("banner-vitoria");
    expect(banner).toHaveTextContent("Mauricio venceu a partida!");
    expect(screen.getByText("Reuniu as 20 cartas do baralho")).toBeInTheDocument();
  });

  it("Partida de 3 Jogadores (AD-6, 2 Cartas descartadas na distribuicao) -- vencedor nunca reune as 32 completas, a contagem mostrada e a REAL (30)", () => {
    const room = criarRoomFalso([
      { sessionId: "host-1", nome: "Mauricio", quantidadeCartas: 30 },
      { sessionId: "convidado-1", nome: "Rafael", quantidadeCartas: 0 },
      { sessionId: "convidado-2", nome: "Carla", quantidadeCartas: 0 },
    ]);

    render(<FimDePartida room={room} />);

    expect(screen.getByText("Reuniu as 30 cartas do baralho")).toBeInTheDocument();
    expect(screen.queryByText(/32 cartas/)).not.toBeInTheDocument();
  });

  it("lista TODOS os Jogadores (vencedor e eliminados) com a propria quantidadeCartas", () => {
    const room = criarRoomFalso([
      { sessionId: "host-1", nome: "Mauricio", quantidadeCartas: 16 },
      { sessionId: "convidado-1", nome: "Rafael", quantidadeCartas: 0 },
    ]);

    render(<FimDePartida room={room} />);

    const lista = screen.getByTestId("lista-jogadores");
    expect(lista).toHaveTextContent("Mauricio");
    expect(lista).toHaveTextContent("16 cartas");
    expect(lista).toHaveTextContent("Rafael");
    expect(lista).toHaveTextContent("0 cartas");
  });

  it("botao 'Jogar Novamente' navega pra / (window.location.href, sem lib de rotas)", () => {
    const room = criarRoomFalso([
      { sessionId: "host-1", nome: "Mauricio", quantidadeCartas: 16 },
      { sessionId: "convidado-1", nome: "Rafael", quantidadeCartas: 0 },
    ]);

    // `window.location` real do jsdom nao aceita reatribuir `href` pra um
    // path relativo sem navegar de verdade (erro "Not implemented") --
    // substitui o objeto inteiro por um stub gravavel so pra este teste
    // espionar a atribuicao, restaurando o original depois.
    const localAnterior = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...localAnterior, href: "" },
    });

    render(<FimDePartida room={room} />);
    fireEvent.click(screen.getByRole("button", { name: "Jogar Novamente" }));

    expect(window.location.href).toBe("/");

    Object.defineProperty(window, "location", { configurable: true, value: localAnterior });
  });

  it("re-renderiza em tempo real via onStateChange quando quantidadeCartas muda (ex: patch de rede tardio)", () => {
    const room = criarRoomFalso([
      { sessionId: "host-1", nome: "Mauricio", quantidadeCartas: 16 },
      { sessionId: "convidado-1", nome: "Rafael", quantidadeCartas: 0 },
    ]);

    render(<FimDePartida room={room} />);
    expect(screen.getByText("Reuniu as 16 cartas do baralho")).toBeInTheDocument();

    const aoMudarEstado = vi.mocked(room.onStateChange).mock.calls[0][0] as () => void;

    (room.state as { jogadores: JogadorFalso[] }).jogadores[0].quantidadeCartas = 32;

    act(() => {
      aoMudarEstado();
    });

    expect(screen.getByText("Reuniu as 32 cartas do baralho")).toBeInTheDocument();
  });

  it("sem Jogadores no estado (ainda nao chegou), nao crasha e nao mostra Banner nenhum", () => {
    const room = criarRoomFalso([]);

    render(<FimDePartida room={room} />);

    expect(screen.queryByTestId("banner-vitoria")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jogar Novamente" })).toBeInTheDocument();
  });
});
