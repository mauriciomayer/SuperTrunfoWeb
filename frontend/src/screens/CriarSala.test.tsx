import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CriarSala } from "./CriarSala.tsx";
import { criarSala } from "../client/colyseusClient.ts";

vi.mock("../client/colyseusClient.ts", () => ({
  criarSala: vi.fn(),
}));

// `globals: false` no vitest.config.ts -- sem cleanup automatico entre
// testes, entao desmonta explicitamente pra nao acumular renders no DOM.
afterEach(() => {
  cleanup();
});

/**
 * Camada de componente (AD-12) da tela Criar Sala. Cobre a linha "Nome
 * vazio" da Matrix da Story 1.2 (botao "Criar Sala" desabilitado ate o
 * nome ser preenchido) e o limite client-side de `totalIA` (defesa em
 * profundidade -- a validacao de verdade e do servidor, ver
 * `backend/src/rooms/PartidaRoom.test.ts`).
 */
describe("CriarSala -- camada de componente (AD-12)", () => {
  it("mantem o botao Criar Sala desabilitado com o nome vazio", () => {
    render(<CriarSala onSalaCriada={() => {}} />);
    expect(screen.getByRole("button", { name: "Criar Sala" })).toBeDisabled();
  });

  it("habilita o botao Criar Sala assim que um nome e digitado", () => {
    render(<CriarSala onSalaCriada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    expect(screen.getByRole("button", { name: "Criar Sala" })).toBeEnabled();
  });

  it("nao deixa totalIA passar de totalJogadores - 1 (sempre sobra a vaga do host)", () => {
    render(<CriarSala onSalaCriada={() => {}} />);
    const aumentarIA = screen.getByRole("button", { name: "Aumentar quantidade de IA" });

    // totalJogadores comeca em 4 -> limite maximo de IA e 3.
    fireEvent.click(aumentarIA);
    fireEvent.click(aumentarIA);
    fireEvent.click(aumentarIA);
    expect(screen.getByTestId("total-ia")).toHaveTextContent("3");

    fireEvent.click(aumentarIA);
    expect(screen.getByTestId("total-ia")).toHaveTextContent("3");
  });

  it("mostra erro e reabilita o botao quando criarSala() rejeita (Matrix: totalIA invalido)", async () => {
    vi.mocked(criarSala).mockRejectedValueOnce(new Error("falhou"));

    render(<CriarSala onSalaCriada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });

    const botaoCriarSala = screen.getByRole("button", { name: "Criar Sala" });
    fireEvent.click(botaoCriarSala);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(botaoCriarSala).toBeEnabled();
    expect(botaoCriarSala).toHaveTextContent("Criar Sala");
  });
});
