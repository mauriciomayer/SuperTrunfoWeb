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
 * componente que assina/desassina o listener).
 */
function criarRoomFalso(jogadores: JogadorFalso[], meuSessionId: string): Room {
  const onStateChange = Object.assign(vi.fn(), { remove: vi.fn() });
  return {
    roomId: "sala-123",
    sessionId: meuSessionId,
    state: {
      jogadores,
      totalJogadoresDeclarado: 4,
      totalIADeclarado: 0,
    },
    onStateChange,
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
