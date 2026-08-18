import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Carta, type CartaFrente } from "./Carta.tsx";
import bandeiraAlemanha from "../assets/bandeiras/alemanha.svg";
import bandeiraReinoUnido from "../assets/bandeiras/reino-unido.svg";
import bandeiraItalia from "../assets/bandeiras/italia.svg";
import bandeiraFranca from "../assets/bandeiras/franca.svg";
import bandeiraEstadosUnidos from "../assets/bandeiras/estados-unidos.svg";

afterEach(() => {
  cleanup();
});

function criarCartaFalsa(sobrescrever: Partial<CartaFrente> = {}): CartaFrente {
  return {
    id: "5B",
    grupo: 5,
    letra: "B",
    pais: "Estados Unidos",
    superTrunfo: false,
    velocidadeMaxima: 305,
    potenciaCv: 650,
    potenciaHp: 641,
    rpmMaximo: 6400,
    cilindrada: 6162,
    aceleracao: 3.5,
    qtdCilindros: 8,
    ...sobrescrever,
  };
}

/**
 * Camada de componente (AD-12) da Carta (frente) -- Story 2.1. Confirma o
 * que o Boundaries pede: badge Grupo/Letra, bandeira do país, todos os
 * Atributos, e nunca o nome do carro (que nem existe em `CartaFrente`).
 */
describe("Carta (frente) -- camada de componente (AD-12)", () => {
  it("mostra o badge Grupo/Letra e a bandeira do país (com nome em title/aria-label)", () => {
    render(<Carta carta={criarCartaFalsa()} />);

    expect(screen.getByText("5B")).toBeInTheDocument();
    expect(screen.getByTitle("Estados Unidos")).toBeInTheDocument();
  });

  it("mostra os 7 Atributos numéricos com seus valores", () => {
    render(<Carta carta={criarCartaFalsa()} />);

    expect(screen.getByText("305 km/h")).toBeInTheDocument();
    expect(screen.getByText("650 CV")).toBeInTheDocument();
    expect(screen.getByText("641 HP")).toBeInTheDocument();
    expect(screen.getByText("6400 RPM")).toBeInTheDocument();
    expect(screen.getByText("6162 cm³")).toBeInTheDocument();
    expect(screen.getByText("3.5 s")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("mostra o placeholder de foto (fotos reais sao Deferred)", () => {
    render(<Carta carta={criarCartaFalsa()} />);
    expect(screen.getByText("foto em breve")).toBeInTheDocument();
  });

  it("mostra o selo Super Trunfo so quando a flag e verdadeira", () => {
    const { rerender } = render(<Carta carta={criarCartaFalsa({ superTrunfo: false })} />);
    expect(screen.queryByText("★ SUPER TRUNFO")).not.toBeInTheDocument();

    rerender(<Carta carta={criarCartaFalsa({ superTrunfo: true })} />);
    expect(screen.getByText("★ SUPER TRUNFO")).toBeInTheDocument();
  });

  it("aplica a classe de moldura dourada so na Carta Super Trunfo", () => {
    render(<Carta carta={criarCartaFalsa({ superTrunfo: true })} />);
    expect(screen.getByTestId("carta-frente")).toHaveClass("carta-frente--supertrunfo");
  });
});

/**
 * Camada de componente (AD-12) da bandeira do pais como imagem real --
 * Story 5.2. Windows nao renderiza emoji de bandeira corretamente (mostra
 * o codigo de duas letras numa caixa); a troca e' pra asset SVG
 * self-hosted, identico em qualquer SO. Cobre os 5 paises mapeados
 * (Alemanha, Reino Unido, Italia, Franca, Estados Unidos) e o fallback
 * residual pra pais nao mapeado.
 */
describe("Carta (frente) -- bandeira do pais como imagem real (Story 5.2)", () => {
  it.each([
    ["Alemanha", bandeiraAlemanha],
    ["Reino Unido", bandeiraReinoUnido],
    ["Italia", bandeiraItalia],
    ["Franca", bandeiraFranca],
    ["Estados Unidos", bandeiraEstadosUnidos],
  ])("renderiza o asset de imagem esperado pra %s (nunca um emoji)", (pais, bandeiraEsperada) => {
    render(<Carta carta={criarCartaFalsa({ pais })} />);

    const badge = screen.getByTitle(pais);
    const imagem = badge.querySelector("img");

    expect(imagem).not.toBeNull();
    expect(imagem).toHaveAttribute("src", bandeiraEsperada);
    // title/aria-label do container ja cobre a semantica -- alt vazio.
    expect(imagem).toHaveAttribute("alt", "");
    // Patch 3 (code review): dimensao explicita via atributos HTML, nao
    // so via CSS -- protecao nativa do navegador contra layout shift
    // mesmo se a folha de estilo atrasar/falhar.
    expect(imagem).toHaveAttribute("width", "20");
    expect(imagem).toHaveAttribute("height", "15");
    expect(badge).not.toHaveTextContent(/\p{Regional_Indicator}/u);
  });

  /**
   * Patch 1 (code review): as 5 asserções acima comparam `src` do `<img>`
   * contra o MESMO valor importado que o componente usa -- comparam o
   * import contra si mesmo, nunca validam os BYTES reais do arquivo no
   * disco (jsdom nunca busca/parseia o recurso referenciado). Um SVG
   * corrompido/vazio passaria pelas asserções acima em silêncio. Este
   * bloco lê cada um dos 5 arquivos direto do disco e confere conteúdo
   * minimamente válido -- é o único jeito de fechar essa lacuna.
   */
  it.each([
    "alemanha.svg",
    "reino-unido.svg",
    "italia.svg",
    "franca.svg",
    "estados-unidos.svg",
  ])("o arquivo %s em src/assets/bandeiras/ existe no disco com conteudo SVG valido", (nomeArquivo) => {
    // `process.cwd()` e' `frontend/` (onde `npm test`/`vitest run` roda) --
    // mais confiavel aqui do que `import.meta.url` (que o Vitest nao
    // sempre resolve pra uma URL `file://` de verdade dentro do
    // ambiente de teste transformado).
    const caminho = resolve(process.cwd(), "src/assets/bandeiras", nomeArquivo);
    const conteudo = readFileSync(caminho, "utf-8");

    expect(conteudo.length).toBeGreaterThan(0);
    expect(conteudo.trimStart().startsWith("<svg")).toBe(true);
  });

  it("mantem o fallback existente (emoji generico) pra pais nao mapeado, sem crash, e avisa no console (Patch 4)", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<Carta carta={criarCartaFalsa({ pais: "Atlantida" })} />);

    const badge = screen.getByTitle("Atlantida");
    expect(badge).toHaveTextContent("🌍");
    expect(badge.querySelector("img")).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0]?.[0]).toContain("Atlantida");

    aviso.mockRestore();
  });

  it("preserva title/aria-label com o nome do pais no badge (acessibilidade)", () => {
    render(<Carta carta={criarCartaFalsa({ pais: "Italia" })} />);

    const badge = screen.getByTitle("Italia");
    expect(badge).toHaveAttribute("aria-label", "Italia");
  });
});

/**
 * Camada de componente (AD-12) da Linha de Atributo clicavel -- Story 2.2.
 * Cobre a Matrix do lado da renderizacao: clique dispara
 * `onSelecionarAtributo` so quando `clicavel`; fora da propria vez
 * (`clicavel=false`, default), a Linha de Atributo nunca e clicavel, nem
 * na propria Carta (Boundaries).
 */
describe("Carta (frente) -- Linha de Atributo clicavel (Story 2.2)", () => {
  it("clique numa Linha de Atributo dispara onSelecionarAtributo com a chave certa quando clicavel", () => {
    const aoSelecionar = vi.fn();
    render(<Carta carta={criarCartaFalsa()} clicavel onSelecionarAtributo={aoSelecionar} />);

    fireEvent.click(screen.getByTestId("linha-atributo-velocidadeMaxima"));

    expect(aoSelecionar).toHaveBeenCalledWith("velocidadeMaxima");
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });

  it("clique numa Linha de Atributo nao dispara nada quando clicavel e falso (default)", () => {
    const aoSelecionar = vi.fn();
    render(<Carta carta={criarCartaFalsa()} onSelecionarAtributo={aoSelecionar} />);

    fireEvent.click(screen.getByTestId("linha-atributo-velocidadeMaxima"));

    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  it("nao expoe role='button' nem tabIndex na Linha de Atributo quando nao e a propria vez", () => {
    render(<Carta carta={criarCartaFalsa()} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    expect(linha).not.toHaveAttribute("role");
    expect(linha).not.toHaveAttribute("tabindex");
    expect(linha).not.toHaveClass("carta-frente__linha-atributo--clicavel");
  });

  it("Enter/Espaco tambem disparam onSelecionarAtributo quando clicavel (acessibilidade de teclado)", () => {
    const aoSelecionar = vi.fn();
    render(<Carta carta={criarCartaFalsa()} clicavel onSelecionarAtributo={aoSelecionar} />);

    const linha = screen.getByTestId("linha-atributo-aceleracao");
    fireEvent.keyDown(linha, { key: "Enter" });
    fireEvent.keyDown(linha, { key: " " });

    expect(aoSelecionar).toHaveBeenNthCalledWith(1, "aceleracao");
    expect(aoSelecionar).toHaveBeenNthCalledWith(2, "aceleracao");
    expect(aoSelecionar).toHaveBeenCalledTimes(2);
  });

  it("ignora auto-repeat do teclado (tecla segurada) -- so a primeira pressionada dispara onSelecionarAtributo", () => {
    const aoSelecionar = vi.fn();
    render(<Carta carta={criarCartaFalsa()} clicavel onSelecionarAtributo={aoSelecionar} />);

    const linha = screen.getByTestId("linha-atributo-velocidadeMaxima");
    fireEvent.keyDown(linha, { key: "Enter", repeat: false });
    fireEvent.keyDown(linha, { key: "Enter", repeat: true });
    fireEvent.keyDown(linha, { key: "Enter", repeat: true });

    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });
});

/**
 * Camada de componente (AD-12) de jogar a Carta Super Trunfo -- Story 2.4,
 * achado de revisao (blind-hunter): antes desta cobertura, nao havia forma
 * correta de jogar a Super Trunfo pela UI -- as Linhas de Atributo eram
 * clicaveis como qualquer Carta normal, mesmo o servidor ignorando
 * `atributo` de qualquer jeito pra essa Carta. Cobre o novo contrato: a
 * Carta INTEIRA fica clicavel (nunca as Linhas) quando `carta.superTrunfo`
 * e `clicavel`, disparando `onSelecionarAtributo()` SEM argumento.
 */
describe("Carta (frente) -- jogar a Super Trunfo (Story 2.4)", () => {
  it("clique na Carta INTEIRA dispara onSelecionarAtributo() SEM argumento quando e Super Trunfo e clicavel", () => {
    const aoSelecionar = vi.fn();
    render(
      <Carta carta={criarCartaFalsa({ superTrunfo: true })} clicavel onSelecionarAtributo={aoSelecionar} />,
    );

    const cartaFrente = screen.getByTestId("carta-frente");
    expect(cartaFrente).toHaveAttribute("role", "button");
    expect(cartaFrente).toHaveClass("carta-frente--clicavel");

    fireEvent.click(cartaFrente);

    expect(aoSelecionar).toHaveBeenCalledWith();
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });

  it("Enter/Espaco na Carta inteira tambem disparam onSelecionarAtributo() (acessibilidade de teclado)", () => {
    const aoSelecionar = vi.fn();
    render(
      <Carta carta={criarCartaFalsa({ superTrunfo: true })} clicavel onSelecionarAtributo={aoSelecionar} />,
    );

    const cartaFrente = screen.getByTestId("carta-frente");
    fireEvent.keyDown(cartaFrente, { key: "Enter" });
    fireEvent.keyDown(cartaFrente, { key: " " });

    expect(aoSelecionar).toHaveBeenCalledTimes(2);
    expect(aoSelecionar).toHaveBeenNthCalledWith(1);
    expect(aoSelecionar).toHaveBeenNthCalledWith(2);
  });

  it("ignora auto-repeat do teclado na Carta inteira -- so a primeira pressionada dispara", () => {
    const aoSelecionar = vi.fn();
    render(
      <Carta carta={criarCartaFalsa({ superTrunfo: true })} clicavel onSelecionarAtributo={aoSelecionar} />,
    );

    const cartaFrente = screen.getByTestId("carta-frente");
    fireEvent.keyDown(cartaFrente, { key: "Enter", repeat: false });
    fireEvent.keyDown(cartaFrente, { key: "Enter", repeat: true });

    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });

  it("nenhuma Linha de Atributo tem interatividade PROPRIA (role/tabIndex/handler) quando a Carta e Super Trunfo, mesmo com clicavel=true", () => {
    const aoSelecionar = vi.fn();
    render(
      <Carta carta={criarCartaFalsa({ superTrunfo: true })} clicavel onSelecionarAtributo={aoSelecionar} />,
    );

    for (const chave of [
      "velocidadeMaxima",
      "potenciaCv",
      "potenciaHp",
      "rpmMaximo",
      "cilindrada",
      "aceleracao",
      "qtdCilindros",
    ]) {
      const linha = screen.getByTestId(`linha-atributo-${chave}`);
      expect(linha).not.toHaveAttribute("role");
      expect(linha).not.toHaveAttribute("tabindex");
      expect(linha).not.toHaveClass("carta-frente__linha-atributo--clicavel");
    }

    // Clicar numa Linha ainda joga a Super Trunfo -- ela e' so conteudo
    // visual DENTRO da Carta inteira clicavel (sem handler/role proprio,
    // o clique borbulha pro container), nao uma "zona morta". O ponto
    // desta Carta e' que nenhuma Linha oferece uma acao DISTINTA por
    // Atributo (o que seria a mentira visual que motivou esta correcao) --
    // qualquer clique dentro da Carta sempre joga a MESMA jogada unica,
    // sem argumento.
    fireEvent.click(screen.getByTestId("linha-atributo-velocidadeMaxima"));
    expect(aoSelecionar).toHaveBeenCalledWith();
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });

  it("a Carta Super Trunfo NAO fica clicavel (nem a Carta inteira, nem nenhuma Linha) fora da propria vez", () => {
    render(<Carta carta={criarCartaFalsa({ superTrunfo: true })} />);

    const cartaFrente = screen.getByTestId("carta-frente");
    expect(cartaFrente).not.toHaveAttribute("role");
    expect(cartaFrente).not.toHaveAttribute("tabindex");
    expect(cartaFrente).not.toHaveClass("carta-frente--clicavel");
  });

  it("uma Carta normal (nao Super Trunfo) nunca expoe role='button' na Carta inteira, mesmo clicavel", () => {
    const aoSelecionar = vi.fn();
    render(
      <Carta
        carta={criarCartaFalsa({ superTrunfo: false })}
        clicavel
        onSelecionarAtributo={aoSelecionar}
      />,
    );

    expect(screen.getByTestId("carta-frente")).not.toHaveAttribute("role");
  });
});

/**
 * Camada de componente (AD-12) do destaque visual da Linha de Atributo
 * selecionada -- Story 2.3. `atributoDestacado` ja chegava encanado desde
 * a Story 2.2 (so marcava `data-destacado`, sem estilo visual proprio);
 * esta Story confere o `data-destacado="true"` de verdade so na Linha que
 * bate com `atributoDestacado`, nunca nas outras.
 */
describe("Carta (frente) -- destaque do Atributo selecionado (Story 2.3)", () => {
  it("marca data-destacado='true' so na Linha que bate com atributoDestacado", () => {
    render(<Carta carta={criarCartaFalsa()} atributoDestacado="aceleracao" />);

    expect(screen.getByTestId("linha-atributo-aceleracao")).toHaveAttribute(
      "data-destacado",
      "true",
    );
    expect(screen.getByTestId("linha-atributo-velocidadeMaxima")).not.toHaveAttribute(
      "data-destacado",
    );
  });

  it("nenhuma Linha e marcada quando atributoDestacado esta ausente", () => {
    render(<Carta carta={criarCartaFalsa()} />);

    for (const chave of [
      "velocidadeMaxima",
      "potenciaCv",
      "potenciaHp",
      "rpmMaximo",
      "cilindrada",
      "aceleracao",
      "qtdCilindros",
    ]) {
      expect(screen.getByTestId(`linha-atributo-${chave}`)).not.toHaveAttribute("data-destacado");
    }
  });
});

/**
 * Camada de componente (AD-12) do destaque da Carta INTEIRA (`destacada`) --
 * Story 2.4. Diferente de `atributoDestacado` (Story 2.3, marca so uma
 * Linha) -- aqui a classe/atributo vai na propria `carta-frente`. Usado
 * pela Mesa de Jogo pra destacar a Carta "A" que anula o Super Trunfo como
 * "a vencedora real".
 */
describe("Carta (frente) -- destaque da Carta inteira (Story 2.4)", () => {
  it("aplica a classe carta-frente--destacada e data-destacada='true' quando destacada=true", () => {
    render(<Carta carta={criarCartaFalsa()} destacada />);

    const cartaFrente = screen.getByTestId("carta-frente");
    expect(cartaFrente).toHaveClass("carta-frente--destacada");
    expect(cartaFrente).toHaveAttribute("data-destacada", "true");
  });

  it("nao aplica a classe/atributo quando destacada e falso (default)", () => {
    render(<Carta carta={criarCartaFalsa()} />);

    const cartaFrente = screen.getByTestId("carta-frente");
    expect(cartaFrente).not.toHaveClass("carta-frente--destacada");
    expect(cartaFrente).not.toHaveAttribute("data-destacada");
  });

  it("destacada e independente de superTrunfo -- as duas classes podem coexistir sem conflito", () => {
    render(<Carta carta={criarCartaFalsa({ superTrunfo: true })} destacada />);

    const cartaFrente = screen.getByTestId("carta-frente");
    expect(cartaFrente).toHaveClass("carta-frente--supertrunfo");
    expect(cartaFrente).toHaveClass("carta-frente--destacada");
  });
});
