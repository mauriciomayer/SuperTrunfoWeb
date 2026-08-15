import { describe, expect, it } from "vitest";
import { ROTA_ENTRAR_SALA } from "./App.tsx";

/**
 * Cobre isoladamente a regex de roteamento local (Story 1.3) que decide
 * entre `EntrarSala` (convidado, path `/sala/:roomId`) e `CriarSala`
 * (qualquer outro path -- comportamento existente da Story 1.2). Testa a
 * regex direto em vez de montar `App` inteiro, ja que o unico
 * comportamento em jogo aqui e o casamento de padrao / captura do
 * `roomId`.
 */
describe("ROTA_ENTRAR_SALA -- regex de roteamento (App.tsx)", () => {
  it("casa /sala/:roomId e captura o roomId", () => {
    const resultado = ROTA_ENTRAR_SALA.exec("/sala/abc123");
    expect(resultado?.[1]).toBe("abc123");
  });

  it("casa /sala/:roomId/ (barra final) e captura o roomId", () => {
    const resultado = ROTA_ENTRAR_SALA.exec("/sala/abc123/");
    expect(resultado?.[1]).toBe("abc123");
  });

  it("nao casa /sala/ sem roomId (comportamento atual -- precisa de ao menos 1 caractere)", () => {
    expect(ROTA_ENTRAR_SALA.exec("/sala/")).toBeNull();
  });

  it("nao casa /sala/a/b (segmento extra depois do roomId)", () => {
    expect(ROTA_ENTRAR_SALA.exec("/sala/a/b")).toBeNull();
  });

  it("nao casa a raiz /", () => {
    expect(ROTA_ENTRAR_SALA.exec("/")).toBeNull();
  });

  it("nao casa outra rota qualquer", () => {
    expect(ROTA_ENTRAR_SALA.exec("/outra-rota")).toBeNull();
  });
});
