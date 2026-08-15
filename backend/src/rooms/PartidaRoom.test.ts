import { describe, expect, it } from "vitest";
import { validarOpcoesCriarSala } from "./PartidaRoom.ts";

/**
 * Camada unitaria (AD-12) da validacao de `criarSala` -- AD-1: o servidor
 * e a autoridade, entao essa regra precisa de cobertura isolada, sem
 * precisar subir uma Room de verdade (isso e a camada de integracao, ver
 * `PartidaRoom.integration.test.ts`).
 */
describe("PartidaRoom -- validacao de criarSala (unitario)", () => {
  it("aceita totalJogadores e totalIA dentro da faixa esperada", () => {
    expect(validarOpcoesCriarSala({ totalJogadores: 4, totalIA: 0 })).toEqual({
      totalJogadores: 4,
      totalIA: 0,
    });
    expect(validarOpcoesCriarSala({ totalJogadores: 3, totalIA: 2 })).toEqual({
      totalJogadores: 3,
      totalIA: 2,
    });
  });

  it("rejeita totalIA sem vaga humana sobrando pro host (Matrix: totalJogadores=2, totalIA=2)", () => {
    expect(() => validarOpcoesCriarSala({ totalJogadores: 2, totalIA: 2 })).toThrow();
  });

  it("aceita a configuracao valida mais apertada (totalJogadores=2, totalIA=1 -- 1 vaga humana sobrando)", () => {
    expect(validarOpcoesCriarSala({ totalJogadores: 2, totalIA: 1 })).toEqual({
      totalJogadores: 2,
      totalIA: 1,
    });
  });

  it("rejeita totalJogadores fora da faixa 2-4", () => {
    expect(() => validarOpcoesCriarSala({ totalJogadores: 1, totalIA: 0 })).toThrow();
    expect(() => validarOpcoesCriarSala({ totalJogadores: 5, totalIA: 0 })).toThrow();
  });

  it("rejeita totalJogadores/totalIA nao inteiros ou ausentes", () => {
    expect(() => validarOpcoesCriarSala({ totalJogadores: 2.5, totalIA: 0 })).toThrow();
    expect(() => validarOpcoesCriarSala({ totalJogadores: 4, totalIA: 1.5 })).toThrow();
    expect(() => validarOpcoesCriarSala({})).toThrow();
  });

  it("rejeita totalIA negativo", () => {
    expect(() => validarOpcoesCriarSala({ totalJogadores: 4, totalIA: -1 })).toThrow();
  });
});
