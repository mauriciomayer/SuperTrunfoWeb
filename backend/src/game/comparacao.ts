import type { Carta } from "../schema/Carta.ts";

/**
 * comparacao.ts -- funcao pura de comparacao de Rodada (Story 2.3,
 * epic-2-context.md > Technical Decisions: "Atributos inversos sao dado,
 * nao `if` hardcoded"). Sem I/O, sem dependencia de `PartidaRoom`/Colyseus
 * -- so numeros entrando, resultado saindo (AD-12: camada unitaria,
 * testavel sem rede).
 */
export interface CandidatoComparacao {
  sessionId: string;
  carta: Carta;
}

/**
 * Resultado de `determinarVencedor`: ou um `sessionId` vencedor unico, ou
 * `empate: true` quando 2+ candidatos empatam no valor vencedor (Story
 * 2.5 resolve o Funil de verdade; esta funcao so sinaliza).
 */
export type ResultadoComparacao =
  | { empate: false; vencedorSessionId: string }
  | { empate: true };

/**
 * determinarVencedor -- maior valor do `atributo` vence, exceto quando
 * `inverso` (so Aceleracao 0-100 km/h, AD-7 em `atributos.ts`), onde vence
 * o MENOR valor. Empate (2+ candidatos no mesmo valor vencedor) sinaliza
 * `{ empate: true }` sem eleger ninguem -- quem decide o que fazer com
 * isso e o chamador (`PartidaRoom.resolverRodada`, Story 2.3/2.5).
 *
 * `atributo` e a `chave` de `atributos.ts` (ex: "velocidadeMaxima"),
 * usada pra indexar o campo numerico correspondente em cada `Carta`.
 */
export function determinarVencedor(
  candidatos: CandidatoComparacao[],
  atributo: string,
  inverso: boolean,
): ResultadoComparacao {
  // Guarda defensiva (achado da revisao do diff): sem candidatos,
  // `Math.max(...[])`/`Math.min(...[])` virariam `-Infinity`/`Infinity`, o
  // filtro de vencedores ficaria vazio, e `vencedores[0].sessionId`
  // explodiria com `TypeError` -- silencioso demais pra debugar dentro do
  // callback do `this.clock.setTimeout` (`PartidaRoom.resolverRodada`).
  // Falha cedo e alto em vez disso: um chamador que monta `candidatos`
  // vazio (ex: todo mundo que jogou a Rodada se desconectou antes do
  // timer disparar) tem um bug pra corrigir no chamador, nao aqui.
  if (candidatos.length === 0) {
    throw new Error("determinarVencedor: candidatos vazio -- nada pra comparar");
  }

  const valores = candidatos.map((candidato) => ({
    sessionId: candidato.sessionId,
    valor: candidato.carta[atributo as keyof Carta] as unknown as number,
  }));

  const melhorValor = inverso
    ? Math.min(...valores.map((item) => item.valor))
    : Math.max(...valores.map((item) => item.valor));

  const vencedores = valores.filter((item) => item.valor === melhorValor);

  if (vencedores.length > 1) {
    return { empate: true };
  }

  return { empate: false, vencedorSessionId: vencedores[0].sessionId };
}
