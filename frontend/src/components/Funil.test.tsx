import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Funil } from "./Funil.tsx";

afterEach(() => {
  cleanup();
});

/**
 * Camada de componente (AD-12) do Funil -- Story 2.5. Cobre a Matrix de
 * visibilidade (Boundaries "Always": visivel sempre que
 * `quantidadeCartasPresas > 0`, independente de qualquer outro estado) e a
 * contagem exibida no titulo da tray.
 */
describe("Funil -- camada de componente (AD-12)", () => {
  it("nao renderiza nada quando quantidadeCartasPresas e 0 (sem empate em andamento)", () => {
    const { container } = render(<Funil quantidadeCartasPresas={0} nomeJogadorDaVez="Mauricio" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a tray com a contagem exata quando quantidadeCartasPresas > 0", () => {
    render(<Funil quantidadeCartasPresas={2} nomeJogadorDaVez="Mauricio" />);

    const funil = screen.getByTestId("funil");
    expect(funil).toBeInTheDocument();
    expect(funil).toHaveTextContent("🃏 Cartas presas no Funil (2)");
    expect(funil).toHaveTextContent(
      "Empate! Mauricio escolhe um novo atributo com a próxima carta.",
    );
  });

  it("acompanha a contagem quando o Funil acumula em empates consecutivos", () => {
    const { rerender } = render(<Funil quantidadeCartasPresas={2} nomeJogadorDaVez="Mauricio" />);
    expect(screen.getByTestId("funil")).toHaveTextContent("Cartas presas no Funil (2)");

    rerender(<Funil quantidadeCartasPresas={4} nomeJogadorDaVez="Mauricio" />);
    expect(screen.getByTestId("funil")).toHaveTextContent("Cartas presas no Funil (4)");
  });

  it("usa um rotulo generico quando nomeJogadorDaVez nao chega (ex: ainda nao decodificado)", () => {
    render(<Funil quantidadeCartasPresas={2} />);

    expect(screen.getByTestId("funil")).toHaveTextContent(
      "Empate! o Jogador da vez escolhe um novo atributo com a próxima carta.",
    );
  });
});
