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
  // Story 7.2: `SalaDeEspera.tsx` assina `room.onLeave`/`room.onError` --
  // precisam existir como signals fake (mesmo padrao de `onStateChange`)
  // pra qualquer teste deste arquivo que renderize a Sala de Espera nao
  // quebrar com "room.onLeave is not a function".
  const onLeave = Object.assign(vi.fn(), { remove: vi.fn() });
  const onError = Object.assign(vi.fn(), { remove: vi.fn() });
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
    onLeave,
    onError,
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

/**
 * Toggle local `mostrarFAQ` (Story 4.1) -- cobre a Matrix inteira: abrir a
 * FAQ a partir da Tela Inicial, voltar preservando o formulario ja
 * preenchido (sem reload -- `CriarSala` fica montada por baixo, so
 * escondida via CSS, ver `App.tsx`), e a FAQ nunca aparecendo depois que
 * `room` existe (Boundaries "Never").
 */
describe("App -- toggle da FAQ (Story 4.1)", () => {
  it("abre a FAQ a partir da Tela Inicial e volta preservando o formulario preenchido", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });

    fireEvent.click(screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" }));

    expect(screen.getByRole("heading", { name: "FAQ — Regras do Jogo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(
      screen.queryByRole("heading", { name: "FAQ — Regras do Jogo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Seu nome")).toHaveValue("Mauricio");
  });

  it("nunca mostra a FAQ (nem o link pra ela) depois que room existe", async () => {
    const { onStateChange, disparar } = criarOnStateChangeFalso();
    const room = criarRoomFalso(onStateChange, "host-1");
    vi.mocked(criarSala).mockResolvedValueOnce(room);

    render(<App />);

    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sala de Espera" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Como funciona? Ver FAQ de regras" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FAQ — Regras do Jogo" })).not.toBeInTheDocument();

    (room.state as { estado: string }).estado = "AguardandoSelecao";
    act(() => {
      disparar();
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mesa de Jogo" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Como funciona? Ver FAQ de regras" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FAQ — Regras do Jogo" })).not.toBeInTheDocument();

    (room.state as { estado: string }).estado = "FimDePartida";
    act(() => {
      disparar();
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Fim de Partida" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Como funciona? Ver FAQ de regras" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FAQ — Regras do Jogo" })).not.toBeInTheDocument();
  });

  /**
   * Achado do code review (ordem nao coberta): o botao da FAQ nao fica
   * `disabled` durante `criando` (diferente do botao "Criar Sala"), entao
   * existe um caminho real onde alguem clica "Criar Sala", e ENQUANTO
   * `criarSala()` ainda esta em voo, clica no botao da FAQ -- abrindo ela
   * -- antes do `room` ser setado. Quando `criarSala()` finalmente resolve
   * e `onSalaCriada(room)` dispara, `room` deixa de ser `null` e o
   * fragment inteiro (`CriarSala` + `FAQ`) precisa sumir de uma vez so
   * (nenhuma tela intermediaria com a FAQ "grudada" por cima da Sala de
   * Espera). Sem este teste, um refactor que hoisteasse `{mostrarFAQ &&
   * <FAQ/>}` pra fora do branch `!room` passaria despercebido.
   */
  it("fecha a FAQ junto com CriarSala se room for criado enquanto a FAQ estava aberta", async () => {
    const { onStateChange } = criarOnStateChangeFalso();
    const room = criarRoomFalso(onStateChange, "host-1");

    let resolverCriarSala: (room: Room) => void = () => {};
    const criarSalaPendente = new Promise<Room>((resolve) => {
      resolverCriarSala = resolve;
    });
    vi.mocked(criarSala).mockReturnValueOnce(criarSalaPendente);

    render(<App />);

    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Sala" }));

    // `criarSala()` ainda em voo -- o botao da FAQ nao esta desabilitado,
    // entao clicar nele agora e um caminho real (nao hipotetico).
    fireEvent.click(screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" }));
    expect(screen.getByRole("heading", { name: "FAQ — Regras do Jogo" })).toBeInTheDocument();

    // So agora `criarSala()` resolve -- `onSalaCriada(room)` dispara com a
    // FAQ ja aberta.
    resolverCriarSala(room);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sala de Espera" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "FAQ — Regras do Jogo" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Como funciona? Ver FAQ de regras" }),
    ).not.toBeInTheDocument();
  });

  /**
   * Achado do code review (asserção ausente): nenhum teste provava que o
   * wrapper que esconde `CriarSala` (`.app-shell__oculto`) realmente ganha
   * essa classe quando `mostrarFAQ` liga e perde quando desliga --
   * `getByRole`/`queryByRole` acham elementos no DOM independente de
   * `display: none` (jsdom nao aplica CSS de arquivos importados aqui,
   * `vitest.config.ts` nao tem `test.css: true`), entao um ternario
   * invertido em `App.tsx` passaria por todos os outros testes.
   */
  it("aplica app-shell__oculto no wrapper de CriarSala so enquanto a FAQ esta aberta", () => {
    render(<App />);

    const wrapper = screen.getByTestId("wrapper-criar-sala");
    expect(wrapper).not.toHaveClass("app-shell__oculto");

    fireEvent.click(screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" }));
    expect(wrapper).toHaveClass("app-shell__oculto");

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(wrapper).not.toHaveClass("app-shell__oculto");
  });

  /**
   * Achado do code review (foco): trocar de tela sem mover o foco perde a
   * posicao de quem navega por teclado/leitor de tela (o navegador reseta
   * pro `<body>`). Abrir a FAQ move o foco pro `<h1>` dela (`FAQ.tsx`);
   * fechar devolve o foco ao botao "Como funciona?" (`CriarSala.tsx`, via
   * `mostrarFAQ`).
   */
  it("move o foco pro heading da FAQ ao abrir, e devolve ao botao da FAQ ao voltar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "FAQ — Regras do Jogo" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" }),
    );
  });
});
