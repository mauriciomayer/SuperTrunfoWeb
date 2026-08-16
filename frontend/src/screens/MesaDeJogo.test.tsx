import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Room } from "@colyseus/sdk";
import { MesaDeJogo } from "./MesaDeJogo.tsx";
import type { CartaFrente } from "../components/Carta.tsx";

afterEach(() => {
  cleanup();
});

interface JogadorFalso {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
  monte?: CartaFrente[];
  quantidadeCartas: number;
}

function criarCartaFalsa(sobrescrever: Partial<CartaFrente> = {}): CartaFrente {
  return {
    id: "2A",
    grupo: 2,
    letra: "A",
    pais: "Italia",
    superTrunfo: true,
    velocidadeMaxima: 340,
    potenciaCv: 800,
    potenciaHp: 789,
    rpmMaximo: 8500,
    cilindrada: 6496,
    aceleracao: 2.9,
    qtdCilindros: 12,
    ...sobrescrever,
  };
}

/**
 * Monta um `Room` falso -- mesmo espirito de `SalaDeEspera.test.tsx`.
 * `estado` do `EstadoPartida` nao importa pra este componente (quem decide
 * renderizar `MesaDeJogo` em vez de `SalaDeEspera` e o `App.tsx`), so
 * `jogadores` e `sessionId`.
 */
function criarRoomFalso(jogadores: JogadorFalso[], meuSessionId: string): Room {
  const onStateChange = Object.assign(vi.fn(), { remove: vi.fn() });
  return {
    roomId: "sala-123",
    sessionId: meuSessionId,
    state: {
      jogadores,
      estado: "AguardandoSelecao",
      jogadorDaVez: meuSessionId,
    },
    onStateChange,
  } as unknown as Room;
}

/**
 * Camada de componente (AD-12) da Mesa de Jogo -- Story 2.1. Cobre a
 * Matrix "Visibilidade de Monte alheio" do lado da renderizacao: a propria
 * Carta do topo aparece por inteiro (`Carta`), os oponentes aparecem so
 * como `CartaVerso` (um por oponente, nao um por Carta do Monte dele).
 */
describe("MesaDeJogo -- camada de componente (AD-12)", () => {
  it("mostra a propria Carta do topo (frente completa) quando o Monte concedido chega", () => {
    const room = criarRoomFalso(
      [
        {
          sessionId: "host-1",
          nome: "Mauricio",
          isHost: true,
          isIA: false,
          monte: [criarCartaFalsa()],
          quantidadeCartas: 16,
        },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
      ],
      "host-1",
    );

    render(<MesaDeJogo room={room} />);

    expect(screen.getByTestId("carta-frente")).toBeInTheDocument();
    expect(screen.getByText("2A")).toBeInTheDocument();
    expect(screen.getByText("★ SUPER TRUNFO")).toBeInTheDocument();
  });

  it("mostra uma Carta (verso) por oponente, nunca o conteudo do Monte dele", () => {
    const room = criarRoomFalso(
      [
        {
          sessionId: "host-1",
          nome: "Mauricio",
          isHost: true,
          isIA: false,
          monte: [criarCartaFalsa()],
          quantidadeCartas: 10,
        },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 10 },
        { sessionId: "", nome: "IA 1", isHost: false, isIA: true, quantidadeCartas: 10 },
      ],
      "host-1",
    );

    render(<MesaDeJogo room={room} />);

    const oponentes = screen.getByTestId("oponentes");
    // 2 oponentes (convidado + IA) -- nunca o proprio Jogador aparece
    // como oponente, nunca conteudo de Carta e exibido pros oponentes.
    expect(oponentes.querySelectorAll(".carta-verso")).toHaveLength(2);
    expect(screen.getByText("Rafael")).toBeInTheDocument();
    expect(screen.getByText("IA 1")).toBeInTheDocument();
    expect(screen.getAllByText("10 cartas")).toHaveLength(2);
    expect(screen.queryAllByTestId("carta-frente")).toHaveLength(1); // so a propria
  });

  it("mostra estado de espera quando a propria Carta ainda nao chegou (monte undefined)", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 0 }],
      "host-1",
    );

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("carta-frente")).not.toBeInTheDocument();
    expect(screen.getByText("Preparando sua carta…")).toBeInTheDocument();
  });

  it("re-renderiza em tempo real via onStateChange quando a propria Carta chega depois", () => {
    const room = criarRoomFalso(
      [{ sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 0 }],
      "host-1",
    );

    render(<MesaDeJogo room={room} />);
    expect(screen.getByText("Preparando sua carta…")).toBeInTheDocument();

    const aoMudarEstado = vi.mocked(room.onStateChange).mock.calls[0][0] as () => void;

    (room.state as { jogadores: JogadorFalso[] }).jogadores[0].monte = [criarCartaFalsa()];
    (room.state as { jogadores: JogadorFalso[] }).jogadores[0].quantidadeCartas = 16;

    act(() => {
      aoMudarEstado();
    });

    expect(screen.getByTestId("carta-frente")).toBeInTheDocument();
    expect(screen.queryByText("Preparando sua carta…")).not.toBeInTheDocument();
  });
});
