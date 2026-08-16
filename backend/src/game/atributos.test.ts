import { describe, expect, it } from "vitest";
import { ATRIBUTOS, atributoValido } from "./atributos.ts";

/**
 * Camada unitaria (AD-12) da config estatica de Atributos (AD-7, Story
 * 2.2): 7 entradas, so "aceleracao" e inversa, `chave` bate com o campo
 * correspondente de `Carta`, e `atributoValido` cobre os 4 cenarios da
 * Matrix (valido, invalido, ausente/undefined, vazio).
 */
describe("atributos -- ATRIBUTOS", () => {
  it("tem exatamente 7 entradas (RF01.4)", () => {
    expect(ATRIBUTOS).toHaveLength(7);
  });

  it("cada entrada tem chave/rotulo unicos e nao-vazios", () => {
    const chaves = ATRIBUTOS.map((atributo) => atributo.chave);
    expect(new Set(chaves).size).toBe(7);

    for (const atributo of ATRIBUTOS) {
      expect(atributo.chave.length).toBeGreaterThan(0);
      expect(atributo.rotulo.length).toBeGreaterThan(0);
    }
  });

  it("so 'aceleracao' e inversa -- as outras 6 nao (AD-7, epic-2-context.md)", () => {
    const inversos = ATRIBUTOS.filter((atributo) => atributo.inverso);
    expect(inversos).toHaveLength(1);
    expect(inversos[0].chave).toBe("aceleracao");
  });

  it("as 7 chaves batem 1:1 com os campos numericos de Carta.ts", () => {
    const chaves = ATRIBUTOS.map((atributo) => atributo.chave).sort();
    expect(chaves).toEqual(
      [
        "aceleracao",
        "cilindrada",
        "potenciaCv",
        "potenciaHp",
        "qtdCilindros",
        "rpmMaximo",
        "velocidadeMaxima",
      ].sort(),
    );
  });
});

describe("atributos -- atributoValido", () => {
  it("aceita qualquer uma das 7 chaves validas", () => {
    for (const atributo of ATRIBUTOS) {
      expect(atributoValido(atributo.chave)).toBe(true);
    }
  });

  it("rejeita chave invalida (nao presente em ATRIBUTOS)", () => {
    expect(atributoValido("potenciaDoMotorInventada")).toBe(false);
  });

  it("rejeita undefined (atributo ausente)", () => {
    expect(atributoValido(undefined)).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(atributoValido("")).toBe(false);
  });
});
