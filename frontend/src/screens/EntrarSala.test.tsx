import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EntrarSala } from "./EntrarSala.tsx";
import { entrarSala } from "../client/colyseusClient.ts";

vi.mock("../client/colyseusClient.ts", () => ({
  entrarSala: vi.fn(),
}));

// `globals: false` no vitest.config.ts -- sem cleanup automatico entre
// testes, entao desmonta explicitamente pra nao acumular renders no DOM.
afterEach(() => {
  cleanup();
});

/**
 * Camada de componente (AD-12) da tela Entrar na Sala. Cobre as linhas
 * "Nome vazio"/"Sala inexistente"/"Sala cheia" da Matrix da Story 1.3: o
 * botao "Entrar na Sala" fica desabilitado ate o nome ser preenchido, e a
 * rejeicao do `entrarSala()` (joinById) substitui o formulario inteiro por
 * uma mensagem -- nunca um erro inline como em `CriarSala`.
 */
describe("EntrarSala -- camada de componente (AD-12)", () => {
  it("mantem o botao Entrar na Sala desabilitado com o nome vazio", () => {
    render(<EntrarSala roomId="sala-123" onSalaEntrada={() => {}} />);
    expect(screen.getByRole("button", { name: "Entrar na Sala" })).toBeDisabled();
  });

  it("habilita o botao Entrar na Sala assim que um nome e digitado", () => {
    render(<EntrarSala roomId="sala-123" onSalaEntrada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Rafael" } });
    expect(screen.getByRole("button", { name: "Entrar na Sala" })).toBeEnabled();
  });

  it("chama entrarSala(nome, roomId) via joinById ao confirmar (AD-2, nunca matchmaking generico)", async () => {
    const roomFalso = { roomId: "sala-123" } as never;
    vi.mocked(entrarSala).mockResolvedValueOnce(roomFalso);
    const onSalaEntrada = vi.fn();

    render(<EntrarSala roomId="sala-123" onSalaEntrada={onSalaEntrada} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Rafael" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar na Sala" }));

    await waitFor(() => {
      expect(onSalaEntrada).toHaveBeenCalledWith(roomFalso);
    });
    expect(entrarSala).toHaveBeenCalledWith("Rafael", "sala-123");
  });

  it("substitui o formulario pela mensagem 'sala nao existe' quando joinById rejeita com 'not found' (Matrix: Sala inexistente)", async () => {
    vi.mocked(entrarSala).mockRejectedValueOnce(new Error('room "sala-invalida" not found'));

    render(<EntrarSala roomId="sala-invalida" onSalaEntrada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Rafael" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar na Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Esta sala não existe mais.");
    });
    expect(screen.getByText("Peça pro host um novo link.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entrar na Sala" })).not.toBeInTheDocument();
  });

  it("substitui o formulario pela mensagem 'sala cheia' quando joinById rejeita com 'locked' (Matrix: Sala cheia)", async () => {
    vi.mocked(entrarSala).mockRejectedValueOnce(new Error('room "sala-cheia" is locked'));

    render(<EntrarSala roomId="sala-cheia" onSalaEntrada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Rafael" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar na Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Esta sala já está cheia.");
    });
    expect(screen.getByText("Peça pro host criar uma nova sala se quiser jogar.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument();
  });

  it("cai numa mensagem generica quando o erro do joinById nao bate com nenhum padrao conhecido", async () => {
    vi.mocked(entrarSala).mockRejectedValueOnce(new Error("falha de rede inesperada"));

    render(<EntrarSala roomId="sala-123" onSalaEntrada={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Rafael" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar na Sala" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument();
  });
});
