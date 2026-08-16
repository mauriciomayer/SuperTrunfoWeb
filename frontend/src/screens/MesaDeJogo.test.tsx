import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Room } from "@colyseus/sdk";
import { MesaDeJogo } from "./MesaDeJogo.tsx";
import type { CartaFrente } from "../components/Carta.tsx";
import { jogarCarta } from "../client/colyseusClient.ts";

vi.mock("../client/colyseusClient.ts", () => ({
  jogarCarta: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
 * `estado`/`rodadaAtual.jogadorDaVez` (Story 2.2) sao parametrizaveis pra
 * cobrir a Matrix de "minha vez" vs "vez do outro".
 */
function criarRoomFalso(
  jogadores: JogadorFalso[],
  meuSessionId: string,
  opcoes: {
    estado?: string;
    jogadorDaVez?: string;
    atributoSelecionado?: string;
    ultimoResultado?: { vencedorNome: string; atributo: string };
  } = {},
): Room {
  const onStateChange = Object.assign(vi.fn(), { remove: vi.fn() });
  return {
    roomId: "sala-123",
    sessionId: meuSessionId,
    state: {
      jogadores,
      estado: opcoes.estado ?? "AguardandoSelecao",
      rodadaAtual: {
        jogadorDaVez: opcoes.jogadorDaVez ?? meuSessionId,
        atributoSelecionado: opcoes.atributoSelecionado ?? "",
      },
      ultimoResultado: opcoes.ultimoResultado,
    },
    onStateChange,
  } as unknown as Room;
}

/**
 * Camada de componente (AD-12) da Mesa de Jogo -- Story 2.1/2.2. Cobre a
 * Matrix "Visibilidade de Monte alheio" do lado da renderizacao: a propria
 * Carta do topo aparece por inteiro (`Carta`), os oponentes aparecem so
 * como `CartaVerso` (um por oponente, nao um por Carta do Monte dele) --
 * a menos que o servidor ja tenha concedido a Carta do topo deles tambem
 * (Story 2.2, Revelando).
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

  it("mostra uma Carta (verso) por oponente, nunca o conteudo do Monte dele, quando o topo dele nao foi concedido", () => {
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

/**
 * Camada de componente (AD-12) da selecao de Atributo/revelacao -- Story
 * 2.2. Cobre as 3 Acceptance Criteria do spec: minha vez habilita a Linha
 * de Atributo (e o clique dispara `jogarCarta`), fora da minha vez nenhuma
 * Linha e clicavel (mesmo na propria Carta) e mostra a mensagem de espera,
 * e um oponente vira `Carta` (frente) assim que `monte?.[0]` chega.
 */
describe("MesaDeJogo -- selecao de Atributo e revelacao (Story 2.2)", () => {
  function montarJogadores(minhaCarta = criarCartaFalsa()): JogadorFalso[] {
    return [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [minhaCarta],
        quantidadeCartas: 16,
      },
      { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
    ];
  }

  it("na minha vez, a Linha de Atributo fica clicavel e o clique dispara jogarCarta com a chave certa", () => {
    const room = criarRoomFalso(montarJogadores(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    expect(linha).toHaveAttribute("role", "button");

    fireEvent.click(linha);

    expect(vi.mocked(jogarCarta)).toHaveBeenCalledWith(room, "velocidadeMaxima");
  });

  it("fora da minha vez, nenhuma Linha de Atributo e clicavel (nem na propria Carta) e mostra 'Aguardando X escolher…'", () => {
    const room = criarRoomFalso(montarJogadores(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "convidado-1",
    });

    render(<MesaDeJogo room={room} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    expect(linha).not.toHaveAttribute("role");
    fireEvent.click(linha);
    expect(vi.mocked(jogarCarta)).not.toHaveBeenCalled();

    expect(screen.getByText("Aguardando Rafael escolher…")).toBeInTheDocument();
  });

  it("nao mostra a mensagem de espera quando e a minha vez", () => {
    const room = criarRoomFalso(montarJogadores(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("aguardando-selecao")).not.toBeInTheDocument();
  });

  it("um oponente vira Carta (frente) quando monte?.[0] chega (revelacao concedida pelo servidor)", () => {
    const cartaOponente = criarCartaFalsa({ id: "5B", grupo: 5, letra: "B", superTrunfo: false });
    const jogadores = montarJogadores();
    jogadores[1].monte = [cartaOponente];

    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "Revelando",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const oponentes = screen.getByTestId("oponentes");
    expect(oponentes.querySelectorAll(".carta-verso")).toHaveLength(0);
    expect(oponentes.querySelectorAll(".carta-frente")).toHaveLength(1);
    expect(screen.getByText("5B")).toBeInTheDocument();
  });

  it("fora de AguardandoSelecao, minha propria Linha de Atributo nao fica clicavel", () => {
    const room = criarRoomFalso(montarJogadores(), "host-1", {
      estado: "Revelando",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.getByTestId("linha-atributo-velocidadeMaxima")).not.toHaveAttribute("role");
  });
});

/**
 * Camada de componente (AD-12) do destaque de Atributo + Chip de Resultado
 * -- Story 2.3. Cobre o Code Map: `atributoDestacado` so passado durante
 * "Revelando" (propria Carta e Cartas de oponentes ja reveladas), e o Chip
 * de Resultado renderizado a partir de `estado.ultimoResultado`.
 */
describe("MesaDeJogo -- destaque de Atributo e Chip de Resultado (Story 2.3)", () => {
  function montarJogadoresRevelados(): JogadorFalso[] {
    return [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A" })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-1",
        nome: "Rafael",
        isHost: false,
        isIA: false,
        monte: [criarCartaFalsa({ id: "5B", superTrunfo: false })],
        quantidadeCartas: 16,
      },
    ];
  }

  it("durante Revelando, atributoDestacado e passado pra propria Carta E pras Cartas ja reveladas dos oponentes", () => {
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "Revelando",
      jogadorDaVez: "host-1",
      atributoSelecionado: "aceleracao",
    });

    render(<MesaDeJogo room={room} />);

    const todasAsLinhasDeAceleracao = screen.getAllByTestId("linha-atributo-aceleracao");
    expect(todasAsLinhasDeAceleracao).toHaveLength(2); // propria + do oponente revelado
    for (const linha of todasAsLinhasDeAceleracao) {
      expect(linha).toHaveAttribute("data-destacado", "true");
    }
  });

  it("fora de Revelando (ex: AguardandoSelecao), nenhuma Linha fica marcada mesmo com atributoSelecionado preenchido no estado", () => {
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      atributoSelecionado: "aceleracao",
    });

    render(<MesaDeJogo room={room} />);

    for (const linha of screen.getAllByTestId("linha-atributo-aceleracao")) {
      expect(linha).not.toHaveAttribute("data-destacado");
    }
  });

  it("mostra o Chip de Resultado com texto (vencedor + rotulo do Atributo) quando ultimoResultado esta preenchido", () => {
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      ultimoResultado: { vencedorNome: "Mauricio", atributo: "velocidadeMaxima" },
    });

    render(<MesaDeJogo room={room} />);

    const chip = screen.getByTestId("chip-resultado");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("Mauricio venceu a rodada com Velocidade Máxima");
  });

  it("nao mostra o Chip de Resultado quando ultimoResultado ainda nao foi preenchido (vencedorNome vazio)", () => {
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      ultimoResultado: { vencedorNome: "", atributo: "" },
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("chip-resultado")).not.toBeInTheDocument();
  });

  it("achado da revisao do diff: nao mostra o Chip de Resultado durante Funil, mesmo com ultimoResultado da Rodada anterior ainda preenchido", () => {
    // `ultimoResultado` nao e limpo pelo schema ao entrar em "Funil" -- o
    // valor da ULTIMA Rodada resolvida sem empate continua la. Sem a
    // checagem de estado, o Chip da Rodada anterior ficaria na tela
    // durante o empate atual, dando a entender (errado) que ja ha
    // vencedor.
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "Funil",
      jogadorDaVez: "host-1",
      ultimoResultado: { vencedorNome: "Mauricio", atributo: "velocidadeMaxima" },
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("chip-resultado")).not.toBeInTheDocument();
  });
});
