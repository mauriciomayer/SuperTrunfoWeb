import { describe, expect, it } from "vitest";
import { Carta } from "../schema/Carta.ts";
import { determinarVencedor } from "./comparacao.ts";

/**
 * Monta uma `Carta` minima so com o campo do Atributo sob teste --
 * `velocidadeMaxima` por padrao, sobrescrevivel campo a campo.
 */
function criarCarta(sobrescrever: Partial<Carta> = {}): Carta {
  const carta = new Carta();
  carta.id = "0X";
  Object.assign(carta, sobrescrever);
  return carta;
}

/**
 * Camada unitaria (AD-12) de `determinarVencedor` (Story 2.3) -- funcao
 * pura, sem rede/Room. Cobre a Matrix do spec: maior valor vence,
 * Atributo inverso (Aceleracao, AD-7) vence o menor, e empate detectado
 * com 2 e com mais de 2 candidatos.
 */
describe("comparacao -- determinarVencedor", () => {
  it("maior valor vence quando o Atributo nao e inverso", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ velocidadeMaxima: 250 }) },
      { sessionId: "b", carta: criarCarta({ velocidadeMaxima: 340 }) },
    ];

    const resultado = determinarVencedor(candidatos, "velocidadeMaxima", false);

    expect(resultado).toEqual({ empate: false, vencedorSessionId: "b" });
  });

  it("Atributo inverso (Aceleracao, AD-7): vence quem tem o MENOR valor", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ aceleracao: 2.9 }) },
      { sessionId: "b", carta: criarCarta({ aceleracao: 4.5 }) },
    ];

    const resultado = determinarVencedor(candidatos, "aceleracao", true);

    expect(resultado).toEqual({ empate: false, vencedorSessionId: "a" });
  });

  it("empate: 2 candidatos no mesmo valor vencedor -- sinaliza empate, sem eleger ninguem", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ velocidadeMaxima: 300 }) },
      { sessionId: "b", carta: criarCarta({ velocidadeMaxima: 300 }) },
    ];

    const resultado = determinarVencedor(candidatos, "velocidadeMaxima", false);

    expect(resultado).toEqual({ empate: true });
  });

  it("empate: mais de 2 candidatos, 3 deles no mesmo valor vencedor entre 4", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ velocidadeMaxima: 300 }) },
      { sessionId: "b", carta: criarCarta({ velocidadeMaxima: 300 }) },
      { sessionId: "c", carta: criarCarta({ velocidadeMaxima: 300 }) },
      { sessionId: "d", carta: criarCarta({ velocidadeMaxima: 200 }) },
    ];

    const resultado = determinarVencedor(candidatos, "velocidadeMaxima", false);

    expect(resultado).toEqual({ empate: true });
  });

  it("empate tambem se aplica ao Atributo inverso (menor valor empatado entre 2+)", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ aceleracao: 3.0 }) },
      { sessionId: "b", carta: criarCarta({ aceleracao: 3.0 }) },
      { sessionId: "c", carta: criarCarta({ aceleracao: 5.0 }) },
    ];

    const resultado = determinarVencedor(candidatos, "aceleracao", true);

    expect(resultado).toEqual({ empate: true });
  });

  it("candidatos vazio -- lanca erro em vez de devolver -Infinity/Infinity ou explodir com TypeError (achado da revisao do diff)", () => {
    expect(() => determinarVencedor([], "velocidadeMaxima", false)).toThrow(
      /candidatos vazio/,
    );
  });

  it("3 candidatos, valores diferentes -- so o maior vence, sem empate", () => {
    const candidatos = [
      { sessionId: "a", carta: criarCarta({ velocidadeMaxima: 250 }) },
      { sessionId: "b", carta: criarCarta({ velocidadeMaxima: 340 }) },
      { sessionId: "c", carta: criarCarta({ velocidadeMaxima: 305 }) },
    ];

    const resultado = determinarVencedor(candidatos, "velocidadeMaxima", false);

    expect(resultado).toEqual({ empate: false, vencedorSessionId: "b" });
  });
});
