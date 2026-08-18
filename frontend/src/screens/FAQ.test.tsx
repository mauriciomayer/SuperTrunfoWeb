import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FAQ } from "./FAQ.tsx";

afterEach(() => {
  cleanup();
});

/**
 * Camada de componente (AD-12) da tela FAQ (Story 4.1). Cobre a Matrix:
 * conteudo cobrindo as 5 areas (Baralho, game loop, Super Trunfo/excecao
 * "A", Funil, fim de jogo) e o botao "Voltar" chamando `onVoltar`.
 */
describe("FAQ -- camada de componente (AD-12)", () => {
  it("mostra perguntas cobrindo as 5 areas exigidas pela Matrix", () => {
    render(<FAQ onVoltar={() => {}} />);

    expect(screen.getByText(/Como é o Baralho\?/)).toBeInTheDocument();
    expect(screen.getByText(/Como funciona uma Rodada\?/)).toBeInTheDocument();
    expect(
      screen.getByText(/O que é a Carta Super Trunfo, e como funciona a exceção da letra "A"\?/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/O que acontece em caso de empate\? Como funciona o Funil\?/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Como a Partida termina\?/)).toBeInTheDocument();
  });

  it("a resposta do Super Trunfo reflete a ordem circular a partir do proximo Jogador (nao 'qualquer adversario')", () => {
    render(<FAQ onVoltar={() => {}} />);

    expect(
      screen.getByText(/começa no próximo Jogador depois de quem jogou o Super Trunfo/),
    ).toBeInTheDocument();
  });

  it("chama onVoltar ao clicar no botao Voltar", () => {
    const onVoltar = vi.fn();
    render(<FAQ onVoltar={onVoltar} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onVoltar).toHaveBeenCalledTimes(1);
  });
});
