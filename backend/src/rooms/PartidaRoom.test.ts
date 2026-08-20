import { describe, expect, it } from "vitest";
import { Metadata } from "@colyseus/schema";
import { validarOpcoesCriarSala, clonarCarta } from "./PartidaRoom.ts";
import { Carta } from "../schema/Carta.ts";

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

/**
 * Camada unitaria (AD-12) de `clonarCarta` (Story 2.2) -- essa funcao ja
 * causou um bug real nesta Story (reusar a mesma instancia de Schema em
 * dois campos diferentes corrompia a arvore de encoding do
 * `@colyseus/schema`, quebrando o `StateView` de outros Clients; ver
 * `PartidaRoom.integration.test.ts`). Ate agora so havia cobertura
 * indireta (via esse teste de integracao); aqui cobre a funcao em
 * isolamento: identidade de objeto diferente + igualdade campo a campo.
 */
describe("PartidaRoom -- clonarCarta (unitario)", () => {
  function criarCartaDeExemplo(): Carta {
    const carta = new Carta();
    carta.id = "2A";
    carta.grupo = 2;
    carta.letra = "A";
    carta.pais = "Italia";
    carta.imagem = "ferrari-812-superfast.jpg";
    carta.modelo = "Ferrari 812 Superfast";
    carta.superTrunfo = true;
    carta.velocidadeMaxima = 340;
    carta.potenciaCv = 800;
    carta.potenciaHp = 789;
    carta.rpmMaximo = 8500;
    carta.cilindrada = 6496;
    carta.aceleracao = 2.9;
    carta.qtdCilindros = 12;
    return carta;
  }

  it("devolve uma instancia diferente da original (nunca a mesma referencia)", () => {
    const original = criarCartaDeExemplo();
    const clone = clonarCarta(original);

    expect(clone).not.toBe(original);
    expect(clone).toBeInstanceOf(Carta);
  });

  it("copia todo campo de Carta.ts campo a campo (iterando `Metadata.getFields`, nao uma lista fixa) -- continua valendo se Carta.ts ganhar um campo novo", () => {
    const original = criarCartaDeExemplo();
    const clone = clonarCarta(original);

    const camposDeCarta = Object.keys(Metadata.getFields(Carta)) as Array<keyof Carta>;
    // Confere que a lista de campos nao esta vazia -- protege contra um
    // futuro em que `Metadata.getFields` mude de forma e o teste vire um
    // no-op silencioso (loop sobre um array vazio nunca falha).
    expect(camposDeCarta.length).toBeGreaterThan(0);

    for (const campo of camposDeCarta) {
      expect(clone[campo]).toEqual(original[campo]);
    }
  });
});
