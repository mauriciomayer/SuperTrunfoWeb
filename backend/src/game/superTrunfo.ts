import type { Carta } from "../schema/Carta.ts";

/**
 * superTrunfo.ts -- funcao pura de resolucao do Super Trunfo (Story 2.4,
 * Boundaries "Always"). Sem I/O, sem dependencia de `PartidaRoom`/Colyseus
 * -- mesma filosofia de `comparacao.ts` (AD-12: camada unitaria, testavel
 * sem rede).
 */
export interface CandidatoSuperTrunfo {
  sessionId: string;
  carta: Carta;
}

/**
 * Resultado de `determinarVencedorSuperTrunfo` -- ao contrario de
 * `determinarVencedor` (comparacao.ts), NUNCA sinaliza empate (Boundaries
 * "Never": "nao existe empate possivel nessa mecanica"). `anuladoPorCartaA`
 * distingue os dois casos pro chamador decidir `tipoVitoria`
 * ("superTrunfo" vs "cartaA", `PartidaRoom.resolverRodada`).
 */
export interface ResultadoSuperTrunfo {
  vencedorSessionId: string;
  anuladoPorCartaA: boolean;
}

/**
 * determinarVencedorSuperTrunfo -- percorre `jogadoresAtivos` em ordem
 * circular a partir de `indiceDoSuperTrunfo + 1` (wraparound, AD-8/Design
 * Notes do spec: "(indice + 1) % total, (indice + 2) % total, ... ate achar
 * a primeira Carta letra 'A' ou voltar ao proprio Jogador do Super
 * Trunfo"). O primeiro Jogador com `carta.letra === "A"` vence
 * (`anuladoPorCartaA: true`); se nenhum for encontrado antes de voltar ao
 * proprio indice, o Jogador do Super Trunfo vence sem oposicao
 * (`anuladoPorCartaA: false`).
 *
 * `jogadoresAtivos` precisa estar na mesma ordem de `state.jogadores`
 * (join order, AD-8) -- quem monta a lista (`PartidaRoom.resolverRodada`)
 * e responsavel por essa ordem, esta funcao so itera.
 */
export function determinarVencedorSuperTrunfo(
  jogadoresAtivos: CandidatoSuperTrunfo[],
  indiceDoSuperTrunfo: number,
): ResultadoSuperTrunfo {
  const total = jogadoresAtivos.length;

  for (let passo = 1; passo < total; passo++) {
    const indice = (indiceDoSuperTrunfo + passo) % total;
    const candidato = jogadoresAtivos[indice];
    if (candidato.carta.letra === "A") {
      return { vencedorSessionId: candidato.sessionId, anuladoPorCartaA: true };
    }
  }

  return {
    vencedorSessionId: jogadoresAtivos[indiceDoSuperTrunfo].sessionId,
    anuladoPorCartaA: false,
  };
}
