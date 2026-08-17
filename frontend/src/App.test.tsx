import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Room } from "@colyseus/sdk";
import App from "./App.tsx";
import { criarSala } from "./client/colyseusClient.ts";

vi.mock("./client/colyseusClient.ts", () => ({
  criarSala: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

/**
 * `onStateChange` falso que guarda TODOS os callbacks registrados (tanto o
 * de `App.tsx` quanto o de `SalaDeEspera.tsx`/`MesaDeJogo.tsx` -- os dois
 * assinam o mesmo `room`, o Colyseus real suporta varios listeners) e
 * expoe um jeito de dispara-los todos de uma vez, simulando um patch de
 * rede chegando.
 */
function criarOnStateChangeFalso() {
  const callbacks: Array<() => void> = [];
  const registrar = vi.fn((callback: () => void) => {
    callbacks.push(callback);
  });
  const remove = vi.fn((callback: () => void) => {
    const indice = callbacks.indexOf(callback);
    if (indice !== -1) callbacks.splice(indice, 1);
  });
  Object.assign(registrar, { remove });
  return {
    onStateChange: registrar as unknown as Room["onStateChange"],
    disparar: () => callbacks.forEach((callback) => callback()),
  };
}

interface JogadorFalso {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
  quantidadeCartas: number;
}

function criarRoomFalso(onStateChange: Room["onStateChange"], meuSessionId: string): Room {
  return {
    roomId: "sala-123",
    sessionId: meuSessionId,
    state: {
      jogadores: [
        { sessionId: meuSessionId, nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 0 },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 0 },
      ] satisfies JogadorFalso[],
      totalJogadoresDeclarado: 2,
      totalIADeclarado: 0,
      estado: "AguardandoJogadores",
      jogadorDaVez: "",
    },
    onStateChange,
    send: vi.fn(),
  } as unknown as Room;
}

/**
 * Camada de componente (AD-12) do roteamento de `App.tsx` -- Story 2.1.
 * O achado do code review: nada provava que a troca `SalaDeEspera` ->
 * `MesaDeJogo` (o `? :` sobre `room.state.estado`) realmente acontecia --
 * invertida, nenhuma suite acusaria, mesmo com o backend distribuindo o
 * Baralho certinho. Este teste monta o `App` de verdade (via o fluxo real
 * de Criar Sala, `criarSala` mockado) e prova a troca de tela em cima de
 * uma mutacao de `room.state.estado` + `onStateChange` disparado.
 */
describe("App -- roteamento por room.state.estado (Story 2.1)", () => {
  it("troca SalaDeEspera por MesaDeJogo quando room.state.estado deixa de ser AguardandoJogadores", async () => {
    const { onStateChange, disparar } = criarOnStateChangeFalso();
    const room = criarRoomFalso(onStateChange, "host-1");
    vi.mocked(criarSala).mockResolvedValueOnce(room);

    render(<App />);

    // Fluxo real de Criar Sala ate `onSalaCriada(room)` disparar em App.
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sala de Espera" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Mesa de Jogo" })).not.toBeInTheDocument();

    // Simula o backend distribuindo o Baralho (Story 2.1, `PartidaRoom`) --
    // muta a mesma instancia de `room.state` (como o Colyseus faz de
    // verdade) e dispara o patch pros listeners inscritos.
    (room.state as { estado: string }).estado = "AguardandoSelecao";
    act(() => {
      disparar();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mesa de Jogo" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Sala de Espera" })).not.toBeInTheDocument();
  });

  /**
   * Story 2.6: `estado === "FimDePartida"` precisa render `FimDePartida`,
   * checado ANTES do fallback pra `MesaDeJogo` -- sem essa ordem, qualquer
   * `estado` que "nao e AguardandoJogadores" (incluindo "FimDePartida")
   * cairia sempre no fallback errado (`MesaDeJogo`), e nenhuma suite
   * acusaria sem este teste especifico.
   */
  it("troca MesaDeJogo por FimDePartida quando room.state.estado vira FimDePartida", async () => {
    const { onStateChange, disparar } = criarOnStateChangeFalso();
    const room = criarRoomFalso(onStateChange, "host-1");
    vi.mocked(criarSala).mockResolvedValueOnce(room);

    render(<App />);

    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sala de Espera" })).toBeInTheDocument();
    });

    // Sala de Espera -> Mesa de Jogo (Story 2.1, ja coberto acima).
    (room.state as { estado: string }).estado = "AguardandoSelecao";
    act(() => {
      disparar();
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mesa de Jogo" })).toBeInTheDocument();
    });

    // Mesa de Jogo -> Fim de Partida (Story 2.6): mesma mutacao de
    // `room.state` + `onStateChange` disparado, simulando o backend
    // detectando um unico Jogador ativo restante (`PartidaRoom.resolverRodada`).
    (room.state as { estado: string }).estado = "FimDePartida";
    act(() => {
      disparar();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Fim de Partida" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Mesa de Jogo" })).not.toBeInTheDocument();
  });
});
