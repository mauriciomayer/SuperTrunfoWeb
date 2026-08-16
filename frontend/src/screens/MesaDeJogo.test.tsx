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
    superTrunfoJogadoPor?: string;
    ultimoResultado?: { vencedorNome: string; atributo: string; tipoVitoria?: string };
    funil?: { quantidadeCartasPresas: number };
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
        superTrunfoJogadoPor: opcoes.superTrunfoJogadoPor ?? "",
      },
      ultimoResultado: opcoes.ultimoResultado,
      funil: opcoes.funil,
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
  // Story 2.4, achado da revisao: o default de `criarCartaFalsa()` e' a
  // Super Trunfo (`superTrunfo: true`) -- Carta cuja Linha de Atributo NAO
  // e' mais clicavel (a Carta inteira vira, ver `Carta.tsx`). Este describe
  // testa o comportamento de selecao de Atributo de uma Carta NORMAL
  // (Story 2.2); o comportamento especifico da Super Trunfo tem describe
  // proprio abaixo ("Super Trunfo (Story 2.4)").
  function montarJogadores(minhaCarta = criarCartaFalsa({ superTrunfo: false })): JogadorFalso[] {
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

  it("Story 2.5: nao mostra o Chip de Resultado durante um empate ativo -- resolverRodada limpa ultimoResultado.vencedorNome no proprio branch de empate, entao vencedorNome vazio ja basta (sem checagem extra de estado)", () => {
    // Estado real pos-empate (PartidaRoom.resolverRodada, Story 2.5):
    // `ultimoResultado` limpo, `funil.quantidadeCartasPresas > 0`, `estado`
    // ja de volta pra "AguardandoSelecao" (nunca fica parado em "Funil" em
    // rede, ver Design Notes do spec).
    const room = criarRoomFalso(montarJogadoresRevelados(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      ultimoResultado: { vencedorNome: "", atributo: "" },
      funil: { quantidadeCartasPresas: 2 },
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("chip-resultado")).not.toBeInTheDocument();
  });
});

/**
 * Camada de componente (AD-12) do Funil -- Story 2.5. Cobre o Code Map: a
 * tray `Funil` e renderizada a partir de `estado.funil.quantidadeCartasPresas`
 * (nunca de `estado.estado`), a Linha de Atributo da propria Carta volta a
 * ficar clicavel na MESMA Rodada logica assim que `jogadorDaVez` continua
 * sendo o proprio (empate preservando a vez), e o Chip de Resultado
 * reaparece assim que o Funil esvazia (Rodada de desempate resolvida).
 */
describe("MesaDeJogo -- Funil (Story 2.5)", () => {
  function montarJogadoresEmpate(): JogadorFalso[] {
    return [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "1A", superTrunfo: false })],
        quantidadeCartas: 15,
      },
      { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 15 },
    ];
  }

  it("mostra a tray do Funil com a contagem certa quando funil.quantidadeCartasPresas > 0, mesmo em AguardandoSelecao (nao so logo apos o empate)", () => {
    const room = criarRoomFalso(montarJogadoresEmpate(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      funil: { quantidadeCartasPresas: 2 },
    });

    render(<MesaDeJogo room={room} />);

    const funil = screen.getByTestId("funil");
    expect(funil).toHaveTextContent("Cartas presas no Funil (2)");
    expect(funil).toHaveTextContent("Empate! Mauricio escolhe um novo atributo com a próxima carta.");
  });

  it("nao mostra a tray do Funil quando quantidadeCartasPresas e 0", () => {
    const room = criarRoomFalso(montarJogadoresEmpate(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      funil: { quantidadeCartasPresas: 0 },
    });

    render(<MesaDeJogo room={room} />);
    expect(screen.queryByTestId("funil")).not.toBeInTheDocument();
  });

  it("nao mostra a tray do Funil (nem crasha) quando o campo funil nem chegou no estado -- exercita o fallback `estado?.funil?.quantidadeCartasPresas ?? 0`", () => {
    // Sem passar `funil` nenhum pra `criarRoomFalso` -- `state.funil` fica
    // `undefined` de verdade (nao `{ quantidadeCartasPresas: 0 }`), mesmo
    // formato que um `EstadoPartida` anterior a Story 2.5 (ou um patch de
    // rede ainda nao decodificado) teria.
    const room = criarRoomFalso(montarJogadoresEmpate(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);
    expect(screen.queryByTestId("funil")).not.toBeInTheDocument();
  });

  it("na mesma Rodada logica do empate (jogadorDaVez preservado), a propria Linha de Atributo volta a ficar clicavel com a Carta que sobrou no topo", () => {
    // Mesmo Jogador que abriu a Rodada empatada (host) continua sendo
    // jogadorDaVez -- nunca passa a vez (Boundaries "Always").
    const room = criarRoomFalso(montarJogadoresEmpate(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      funil: { quantidadeCartasPresas: 2 },
    });

    render(<MesaDeJogo room={room} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    expect(linha).toHaveAttribute("role", "button");

    fireEvent.click(linha);
    expect(vi.mocked(jogarCarta)).toHaveBeenCalledWith(room, "velocidadeMaxima");
  });

  it("o Chip de Resultado reaparece assim que o Funil esvazia (Rodada de desempate resolvida sem empate)", () => {
    const room = criarRoomFalso(montarJogadoresEmpate(), "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
      ultimoResultado: { vencedorNome: "Mauricio", atributo: "velocidadeMaxima" },
      funil: { quantidadeCartasPresas: 0 },
    });

    render(<MesaDeJogo room={room} />);

    expect(screen.queryByTestId("funil")).not.toBeInTheDocument();
    expect(screen.getByTestId("chip-resultado")).toHaveTextContent(
      "Mauricio venceu a rodada com Velocidade Máxima",
    );
  });
});

/**
 * Camada de componente (AD-12) do Super Trunfo -- Story 2.4. Cobre as 3
 * variantes de texto do Chip de Resultado (`tipoVitoria`), o destaque da
 * Carta "A" vencedora real (`destacada`) durante "SuperTrunfoAcionado", e
 * (achado de revisao, blind-hunter) o gatilho real de JOGAR a Super Trunfo
 * a partir de "AguardandoSelecao" -- todos os testes anteriores desta
 * historia comecavam ja dentro de "SuperTrunfoAcionado" (pos-clique), sem
 * nenhuma cobertura do clique em si que dispara a jogada.
 */
describe("MesaDeJogo -- Super Trunfo (Story 2.4)", () => {
  it("Chip de Resultado -- variante 'atributo' (fluxo normal, Story 2.3) permanece inalterada", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 16 },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
      ],
      "host-1",
      {
        ultimoResultado: {
          vencedorNome: "Mauricio",
          atributo: "velocidadeMaxima",
          tipoVitoria: "atributo",
        },
      },
    );

    render(<MesaDeJogo room={room} />);

    expect(screen.getByTestId("chip-resultado")).toHaveTextContent(
      "Mauricio venceu a rodada com Velocidade Máxima",
    );
  });

  it("Chip de Resultado -- variante 'superTrunfo' (vitoria automatica sem oposicao)", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 17 },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 15 },
      ],
      "host-1",
      {
        ultimoResultado: { vencedorNome: "Mauricio", atributo: "", tipoVitoria: "superTrunfo" },
      },
    );

    render(<MesaDeJogo room={room} />);

    const chip = screen.getByTestId("chip-resultado");
    expect(chip).toHaveTextContent("Mauricio venceu com a Super Trunfo!");
    // Nunca menciona um Atributo -- nao houve comparacao nenhuma.
    expect(chip).not.toHaveTextContent("Velocidade");
  });

  it("Chip de Resultado -- variante 'cartaA' (Super Trunfo anulado por uma Carta 'A')", () => {
    const room = criarRoomFalso(
      [
        { sessionId: "host-1", nome: "Mauricio", isHost: true, isIA: false, quantidadeCartas: 15 },
        { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 17 },
      ],
      "host-1",
      {
        ultimoResultado: { vencedorNome: "Rafael", atributo: "", tipoVitoria: "cartaA" },
      },
    );

    render(<MesaDeJogo room={room} />);

    expect(screen.getByTestId("chip-resultado")).toHaveTextContent(
      'Rafael anulou a Super Trunfo com uma Carta "A"!',
    );
  });

  it("SuperTrunfoAcionado sem oposicao: nenhuma Carta fica destacada (ninguem tem letra 'A')", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", letra: "A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-1",
        nome: "Rafael",
        isHost: false,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2B", letra: "B", superTrunfo: false })],
        quantidadeCartas: 16,
      },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "SuperTrunfoAcionado",
      jogadorDaVez: "host-1",
      superTrunfoJogadoPor: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    for (const cartaFrente of screen.getAllByTestId("carta-frente")) {
      expect(cartaFrente).not.toHaveClass("carta-frente--destacada");
    }
  });

  it("SuperTrunfoAcionado anulado: a Carta do oponente com letra 'A' fica destacada como a vencedora real", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", letra: "A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-1",
        nome: "Rafael",
        isHost: false,
        isIA: false,
        monte: [criarCartaFalsa({ id: "1A", letra: "A", superTrunfo: false })],
        quantidadeCartas: 16,
      },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "SuperTrunfoAcionado",
      jogadorDaVez: "host-1",
      superTrunfoJogadoPor: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const oponentes = screen.getByTestId("oponentes");
    const cartaOponente = oponentes.querySelector(".carta-frente");
    expect(cartaOponente).toHaveClass("carta-frente--destacada");

    // A propria Carta (a Super Trunfo, que foi anulada) NUNCA fica
    // destacada -- so a Carta "A" real vencedora.
    const minhaCarta = document.querySelector(".mesa-de-jogo__minha-carta .carta-frente");
    expect(minhaCarta).not.toHaveClass("carta-frente--destacada");
  });

  it("SuperTrunfoAcionado com multiplos oponentes 'A': destaca so quem esta mais proximo, em ordem circular, do Jogador do Super Trunfo", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", letra: "A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-1",
        nome: "Rafael",
        isHost: false,
        isIA: false,
        // Mais proximo (1 passo) -- sem "A", nao deveria ser destacado.
        monte: [criarCartaFalsa({ id: "2B", letra: "B", superTrunfo: false })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-2",
        nome: "Carla",
        isHost: false,
        isIA: false,
        // 2 passos -- primeira Carta "A" encontrada na ordem circular.
        monte: [criarCartaFalsa({ id: "3A", letra: "A", superTrunfo: false })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "convidado-3",
        nome: "Bruno",
        isHost: false,
        isIA: false,
        // 3 passos -- tambem tem "A", mas mais distante -- nunca vence.
        monte: [criarCartaFalsa({ id: "4A", letra: "A", superTrunfo: false })],
        quantidadeCartas: 16,
      },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "SuperTrunfoAcionado",
      jogadorDaVez: "host-1",
      superTrunfoJogadoPor: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const oponentes = screen.getByTestId("oponentes").querySelectorAll(".carta-frente");
    expect(oponentes).toHaveLength(3);
    // Ordem de renderizacao segue a ordem de `oponentes` (filtro sobre
    // `jogadores`, preservando a ordem original): Rafael, Carla, Bruno.
    expect(oponentes[0]).not.toHaveClass("carta-frente--destacada"); // Rafael (sem "A")
    expect(oponentes[1]).toHaveClass("carta-frente--destacada"); // Carla (mais proxima com "A")
    expect(oponentes[2]).not.toHaveClass("carta-frente--destacada"); // Bruno (mais distante)
  });

  it("na minha vez, com a Super Trunfo no topo, clicar na Carta INTEIRA dispara jogarCarta(room) sem atributo", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const minhaCarta = document
      .querySelector(".mesa-de-jogo__minha-carta")!
      .querySelector('[data-testid="carta-frente"]')!;
    expect(minhaCarta).toHaveAttribute("role", "button");

    fireEvent.click(minhaCarta);

    expect(vi.mocked(jogarCarta)).toHaveBeenCalledWith(room, undefined);
    expect(vi.mocked(jogarCarta)).toHaveBeenCalledTimes(1);
  });

  it("na minha vez, com a Super Trunfo no topo, nenhuma Linha de Atributo tem interatividade PROPRIA (role/handler distinto)", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    expect(linha).not.toHaveAttribute("role");

    // A Linha nao tem handler proprio -- o clique borbulha pra Carta
    // inteira (o gatilho real da jogada de Super Trunfo, sem argumento),
    // nunca por uma acao distinta por Atributo (Linhas de Super Trunfo nao
    // oferecem escolha nenhuma, ao contrario de uma Carta normal).
    fireEvent.click(linha);

    expect(vi.mocked(jogarCarta)).toHaveBeenCalledWith(room, undefined);
    expect(vi.mocked(jogarCarta)).toHaveBeenCalledTimes(1);
  });

  it("fora da minha vez, a propria Carta Super Trunfo no topo NAO fica clicavel (nem a Carta inteira)", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      { sessionId: "convidado-1", nome: "Rafael", isHost: false, isIA: false, quantidadeCartas: 16 },
    ];
    // jogadorDaVez e o CONVIDADO -- nao e a vez do host, mesmo com a
    // Super Trunfo no proprio topo.
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "AguardandoSelecao",
      jogadorDaVez: "convidado-1",
    });

    render(<MesaDeJogo room={room} />);

    const minhaCarta = document
      .querySelector(".mesa-de-jogo__minha-carta")!
      .querySelector('[data-testid="carta-frente"]')!;
    expect(minhaCarta).not.toHaveAttribute("role");
    expect(minhaCarta).not.toHaveClass("carta-frente--clicavel");

    fireEvent.click(minhaCarta);
    expect(vi.mocked(jogarCarta)).not.toHaveBeenCalled();
  });

  it("achado de revisao (edge-case-hunter): com varios assentos de IA (sessionId compartilhado ''), so o assento que REALMENTE tem a Carta 'A' fica destacado", () => {
    const jogadores = [
      {
        sessionId: "host-1",
        nome: "Mauricio",
        isHost: true,
        isIA: false,
        monte: [criarCartaFalsa({ id: "2A", letra: "A", superTrunfo: true })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "", // IA -- mais proxima (1 passo), SEM Carta "A".
        nome: "IA 1",
        isHost: false,
        isIA: true,
        monte: [criarCartaFalsa({ id: "2B", letra: "B", superTrunfo: false })],
        quantidadeCartas: 16,
      },
      {
        sessionId: "", // IA -- mesmo sessionId "" da IA 1, mas ESTA e' a vencedora real (2 passos, tem "A").
        nome: "IA 2",
        isHost: false,
        isIA: true,
        monte: [criarCartaFalsa({ id: "3A", letra: "A", superTrunfo: false })],
        quantidadeCartas: 16,
      },
    ];
    const room = criarRoomFalso(jogadores, "host-1", {
      estado: "SuperTrunfoAcionado",
      jogadorDaVez: "host-1",
      superTrunfoJogadoPor: "host-1",
    });

    render(<MesaDeJogo room={room} />);

    const cartasDosOponentes = screen.getByTestId("oponentes").querySelectorAll(".carta-frente");
    expect(cartasDosOponentes).toHaveLength(2);
    // Ordem de renderizacao segue `oponentes` (filtro sobre `jogadores`,
    // preserva a ordem original): IA 1 primeiro, IA 2 depois -- so a IA 2
    // (a que tem a Carta "A" de verdade) deveria ficar destacada, mesmo as
    // duas compartilhando `sessionId === ""`.
    expect(cartasDosOponentes[0]).not.toHaveClass("carta-frente--destacada"); // IA 1 (sem "A")
    expect(cartasDosOponentes[1]).toHaveClass("carta-frente--destacada"); // IA 2 (com "A", vencedora real)
  });
});
