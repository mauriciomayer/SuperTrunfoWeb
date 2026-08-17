import type { Jogador } from "../schema/Jogador.ts";

/**
 * turno.ts -- funcao pura de avanco de vez (Story 2.6). Sem I/O, sem
 * dependencia de `PartidaRoom`/Colyseus -- mesma filosofia de
 * `comparacao.ts`/`superTrunfo.ts` (AD-12: camada unitaria, testavel sem
 * rede).
 */

/**
 * proximoJogadorAtivo -- percorre `jogadores` (ordem de `state.jogadores`,
 * join order, mesmo padrao circular AD-8 de `determinarVencedorSuperTrunfo`)
 * em ordem circular a partir de `sessionIdAtual + 1`, ate achar o primeiro
 * Jogador ativo (`monte.length > 0`). Usada so quando o proprio
 * `jogadorDaVez` acabou de ser eliminado por um empate (Story 2.6,
 * Boundaries "Always": "a Carta empatada era a ultima dele") -- pula
 * qualquer numero de Jogadores ja inativos no caminho (eliminados nesta ou
 * em Rodadas anteriores), nao so o proximo da lista.
 *
 * Nunca deveria ser chamada com todo mundo ativo (nesse caso o proprio
 * `jogadorDaVez` continuaria ativo e nao precisaria pular ninguem) nem com
 * o caso totalmente degenerado de ninguem ativo (`PartidaRoom.resolverRodada`
 * so invoca isso depois de garantir `ativos.length >= 2` no branch de
 * empate) -- mas o loop e limitado a `total` passos pra nunca travar, mesmo
 * fora dessas premissas: se nenhum Jogador ativo for encontrado (ou se
 * `sessionIdAtual` nem estiver mais em `jogadores`, ex: desconectou),
 * devolve o proprio `sessionIdAtual` recebido como fallback seguro.
 */
export function proximoJogadorAtivo(jogadores: Jogador[], sessionIdAtual: string): string {
  const indiceAtual = jogadores.findIndex((jogador) => jogador.sessionId === sessionIdAtual);
  if (indiceAtual === -1) {
    return sessionIdAtual;
  }

  const total = jogadores.length;
  for (let passo = 1; passo <= total; passo++) {
    const indice = (indiceAtual + passo) % total;
    if (jogadores[indice].monte.length > 0) {
      return jogadores[indice].sessionId;
    }
  }

  return sessionIdAtual;
}
