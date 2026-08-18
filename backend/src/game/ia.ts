import type { Carta } from "../schema/Carta.ts";
import { ATRIBUTOS } from "./atributos.ts";

/**
 * ia.ts -- decisao de jogo da IA (Story 3.1, Approach). Sem I/O, sem
 * dependencia de `PartidaRoom`/Colyseus -- mesma filosofia de
 * `comparacao.ts`/`superTrunfo.ts`/`turno.ts` (AD-12: camada unitaria,
 * testavel sem rede).
 */

/**
 * decidirAtributoIA -- escolhe uma `chave` aleatoria (distribuicao
 * uniforme) entre as 7 de `ATRIBUTOS` (`atributos.ts`). Estrategia
 * deliberadamente simples (spec Boundaries "Always"): nunca avalia odds
 * nem Cartas de oponentes -- nem faria sentido, ja que nao ha oponentes
 * visiveis antes da revelacao de qualquer jeito (mesmo anti-cheat de
 * StateView que protege um Jogador humano, `Jogador.monte` no
 * `PartidaRoom`).
 *
 * `carta` -- a propria Carta do topo da IA, ja resolvida pelo chamador
 * (`PartidaRoom.resolverRodada`) -- fica na assinatura por completude/
 * simetria com uma decisao real de jogo (Code Map do spec), mas NAO
 * influencia a escolha nesta Story: reservado pra uma estrategia futura
 * mais esperta, fora de escopo aqui. O chamador so invoca esta funcao
 * quando `carta` NAO e a Super Trunfo (esse branch e decidido antes, via
 * `carta.superTrunfo`, reaproveitando o `ehSuperTrunfo` ja existente em
 * `processarJogada` -- nunca duplicado aqui).
 */
export function decidirAtributoIA(carta: Carta): string {
  const indice = Math.floor(Math.random() * ATRIBUTOS.length);
  return ATRIBUTOS[indice].chave;
}
