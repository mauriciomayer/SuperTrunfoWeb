import { describe, expect, it } from "vitest";
import { Jogador } from "../schema/Jogador.ts";
import { Carta } from "../schema/Carta.ts";
import { proximoJogadorAtivo } from "./turno.ts";

/**
 * Monta um `Jogador` minimo so com `sessionId` e um Monte com
 * `quantidadeCartas` Cartas vazias (unico campo que `proximoJogadorAtivo`
 * le e' `monte.length`, os valores das Cartas em si sao irrelevantes).
 */
function criarJogador(sessionId: string, quantidadeCartas: number): Jogador {
  const jogador = new Jogador();
  jogador.sessionId = sessionId;
  for (let indice = 0; indice < quantidadeCartas; indice++) {
    jogador.monte.push(new Carta());
  }
  return jogador;
}

/**
 * Camada unitaria (AD-12) de `proximoJogadorAtivo` (Story 2.6) -- funcao
 * pura, sem rede/Room. Cobre a Matrix do spec: pular o Jogador
 * recem-eliminado, wraparound, multiplos eliminados em sequencia, e os
 * casos degenerados/defensivos que a funcao precisa sobreviver sem travar.
 */
describe("turno -- proximoJogadorAtivo", () => {
  it("pula o proprio jogadorDaVez recem-eliminado e acha o proximo ativo, em join order", () => {
    const jogadores = [criarJogador("a", 0), criarJogador("b", 5), criarJogador("c", 3)];

    expect(proximoJogadorAtivo(jogadores, "a")).toBe("b");
  });

  it("pula jogadores INATIVOS intermediarios (eliminados em Rodadas anteriores), nao so o proximo da lista", () => {
    const jogadores = [criarJogador("a", 0), criarJogador("b", 0), criarJogador("c", 4)];

    expect(proximoJogadorAtivo(jogadores, "a")).toBe("c");
  });

  it("wraparound: o proximo ativo esta no INICIO da lista, o atual esta no FIM (circular)", () => {
    const jogadores = [criarJogador("a", 2), criarJogador("b", 4), criarJogador("c", 0)];

    expect(proximoJogadorAtivo(jogadores, "c")).toBe("a");
  });

  it("2 Jogadores (sala minima): pula direto pro unico outro ativo", () => {
    const jogadores = [criarJogador("a", 0), criarJogador("b", 6)];

    expect(proximoJogadorAtivo(jogadores, "a")).toBe("b");
  });

  it("multiplos eliminados em sequencia: uma 2a chamada a partir do novo jogadorDaVez tambem pula quem ja estava eliminado", () => {
    const jogadores = [
      criarJogador("a", 0),
      criarJogador("b", 0),
      criarJogador("c", 0),
      criarJogador("d", 2),
    ];

    const proximo1 = proximoJogadorAtivo(jogadores, "a");
    expect(proximo1).toBe("d");

    // "b" e "c" (entre "a" e "d") continuam eliminados -- uma chamada
    // subsequente a partir de outro ponto da lista ainda os pula.
    const proximo2 = proximoJogadorAtivo(jogadores, "b");
    expect(proximo2).toBe("d");
  });

  it("defensivo -- todo mundo ativo (nao deveria ser chamada nesse caso): nao trava, acha o proximo na ordem circular", () => {
    const jogadores = [criarJogador("a", 5), criarJogador("b", 5), criarJogador("c", 5)];

    expect(proximoJogadorAtivo(jogadores, "a")).toBe("b");
    expect(proximoJogadorAtivo(jogadores, "c")).toBe("a"); // wraparound
  });

  it("degenerado -- ninguem ativo (nem o proprio sessionIdAtual): nao trava, devolve o proprio sessionIdAtual como fallback", () => {
    const jogadores = [criarJogador("a", 0), criarJogador("b", 0), criarJogador("c", 0)];

    expect(proximoJogadorAtivo(jogadores, "a")).toBe("a");
  });

  it("sessionIdAtual nao encontrado em jogadores (ex: desconectou): nao trava, devolve o proprio sessionIdAtual recebido", () => {
    const jogadores = [criarJogador("b", 5), criarJogador("c", 3)];

    expect(proximoJogadorAtivo(jogadores, "fantasma")).toBe("fantasma");
  });
});
