import { describe, expect, it } from "vitest";
import { Carta } from "../schema/Carta.ts";
import { determinarVencedorSuperTrunfo, type CandidatoSuperTrunfo } from "./superTrunfo.ts";

/** Monta uma `Carta` minima so com `letra` (unico campo que a funcao le). */
function criarCarta(letra: string, sobrescrever: Partial<Carta> = {}): Carta {
  const carta = new Carta();
  carta.id = `0${letra}`;
  carta.letra = letra;
  Object.assign(carta, sobrescrever);
  return carta;
}

function candidato(sessionId: string, letra: string): CandidatoSuperTrunfo {
  return { sessionId, carta: criarCarta(letra) };
}

/**
 * Camada unitaria (AD-12) de `determinarVencedorSuperTrunfo` (Story 2.4) --
 * funcao pura, sem rede/Room. Cobre a Matrix do spec: sem oposicao, uma
 * Carta "A", multiplas Cartas "A" em ordem circular (incluindo wraparound
 * do fim pro inicio da lista).
 */
describe("superTrunfo -- determinarVencedorSuperTrunfo", () => {
  it("sem oposicao: nenhum oponente tem Carta letra 'A' -- o proprio Jogador do Super Trunfo vence", () => {
    const jogadoresAtivos = [
      candidato("a", "B"),
      candidato("b", "C"), // Super Trunfo (indice 1) -- letra da propria carta irrelevante aqui
      candidato("c", "D"),
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 1);

    expect(resultado).toEqual({ vencedorSessionId: "b", anuladoPorCartaA: false });
  });

  it("uma Carta 'A': o oponente com a Carta 'A' vence, anulando o Super Trunfo", () => {
    const jogadoresAtivos = [
      candidato("a", "B"), // Super Trunfo (indice 0)
      candidato("b", "A"),
      candidato("c", "C"),
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 0);

    expect(resultado).toEqual({ vencedorSessionId: "b", anuladoPorCartaA: true });
  });

  it("multiplas Cartas 'A': vence quem estiver mais proximo, em ordem circular, do Jogador do Super Trunfo", () => {
    const jogadoresAtivos = [
      candidato("a", "B"), // Super Trunfo (indice 0)
      candidato("b", "C"), // mais proximo, sem "A"
      candidato("c", "A"), // 2 passos -- mais proximo dos dois "A"
      candidato("d", "A"), // 3 passos -- mais distante
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 0);

    expect(resultado).toEqual({ vencedorSessionId: "c", anuladoPorCartaA: true });
  });

  it("wraparound: o Super Trunfo esta no FIM da lista, a Carta 'A' mais proxima esta no INICIO (circular)", () => {
    const jogadoresAtivos = [
      candidato("a", "A"), // indice 0 -- alcancado so apos o wraparound
      candidato("b", "C"),
      candidato("c", "D"), // Super Trunfo (indice 2, ultimo da lista)
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 2);

    expect(resultado).toEqual({ vencedorSessionId: "a", anuladoPorCartaA: true });
  });

  it("wraparound sem oposicao: percorre a lista inteira e volta ao proprio indice sem achar nenhuma Carta 'A'", () => {
    const jogadoresAtivos = [
      candidato("a", "B"),
      candidato("b", "C"),
      candidato("c", "D"), // Super Trunfo (indice 2)
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 2);

    expect(resultado).toEqual({ vencedorSessionId: "c", anuladoPorCartaA: false });
  });

  it("2 Jogadores (sala minima): sem Carta 'A' no oponente -- Super Trunfo vence sem oposicao", () => {
    const jogadoresAtivos = [
      candidato("a", "D"), // Super Trunfo (indice 0)
      candidato("b", "B"),
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 0);

    expect(resultado).toEqual({ vencedorSessionId: "a", anuladoPorCartaA: false });
  });

  it("2 Jogadores (sala minima): oponente com Carta 'A' -- anula o Super Trunfo", () => {
    const jogadoresAtivos = [
      candidato("a", "D"), // Super Trunfo (indice 0)
      candidato("b", "A"),
    ];

    const resultado = determinarVencedorSuperTrunfo(jogadoresAtivos, 0);

    expect(resultado).toEqual({ vencedorSessionId: "b", anuladoPorCartaA: true });
  });
});
