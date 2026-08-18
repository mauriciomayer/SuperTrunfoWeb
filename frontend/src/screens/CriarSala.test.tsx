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
    render(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={false} />);
    expect(screen.getByRole("button", { name: "Criar Sala" })).toBeDisabled();
  });

  it("habilita o botao Criar Sala assim que um nome e digitado", () => {
    render(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={false} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });
    expect(screen.getByRole("button", { name: "Criar Sala" })).toBeEnabled();
  });

  it("nao deixa totalIA passar de totalJogadores - 1 (sempre sobra a vaga do host)", () => {
    render(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={false} />);
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

    render(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={false} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Mauricio" } });

    const botaoCriarSala = screen.getByRole("button", { name: "Criar Sala" });
    fireEvent.click(botaoCriarSala);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(botaoCriarSala).toBeEnabled();
    expect(botaoCriarSala).toHaveTextContent("Criar Sala");
  });

  /**
   * Story 4.1: o texto estatico "Como funciona? Ver FAQ de regras" (herdado
   * da Story 1.2) virou um `<button>` interativo que dispara `onAbrirFAQ` --
   * nunca um `<a href>`, ja que nao existe rota real pra FAQ.
   */
  it("chama onAbrirFAQ ao clicar em 'Como funciona? Ver FAQ de regras'", () => {
    const onAbrirFAQ = vi.fn();
    render(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={onAbrirFAQ} mostrarFAQ={false} />);

    const botaoFAQ = screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" });
    fireEvent.click(botaoFAQ);

    expect(onAbrirFAQ).toHaveBeenCalledTimes(1);
  });

  /**
   * Achado do code review (gerenciamento de foco): `mostrarFAQ` so serve
   * pro `useEffect` interno devolver o foco ao botao "Como funciona?"
   * assim que a FAQ fecha (transicao true -> false) -- sem isso, um
   * usuario de teclado/leitor de tela perderia a posicao quando `FAQ`
   * desmonta em `App.tsx`. Testado aqui isolado (via `rerender`, sem
   * precisar montar `App`/`FAQ` inteiros) porque o `ref` e o `useEffect`
   * vivem dentro de `CriarSala`.
   */
  it("devolve o foco ao botao 'Como funciona?' quando mostrarFAQ passa de true pra false", () => {
    const { rerender } = render(
      <CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={true} />,
    );

    const botaoFAQ = screen.getByRole("button", { name: "Como funciona? Ver FAQ de regras" });
    expect(botaoFAQ).not.toHaveFocus();

    rerender(<CriarSala onSalaCriada={() => {}} onAbrirFAQ={() => {}} mostrarFAQ={false} />);

    expect(botaoFAQ).toHaveFocus();
  });
});
