import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Carta, type CartaFrente } from "./Carta.tsx";

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
