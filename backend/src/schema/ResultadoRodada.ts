import { Schema, type } from "@colyseus/schema";

/**
 * Tipo de vitoria da ultima Rodada resolvida (Story 2.4, Boundaries
 * "Always"): "atributo" pro fluxo normal de comparacao (Story 2.3);
 * "superTrunfo" quando o proprio Jogador do Super Trunfo venceu sem
 * oposicao; "cartaA" quando um oponente com Carta letra "A" anulou o
 * Super Trunfo. Frontend usa pra escolher o texto do Chip de Resultado
 * (UX-DR7) -- variantes diferentes de texto pra cada caso, nunca so a cor
 * dourada (Boundaries).
 */
export type TipoVitoria = "atributo" | "superTrunfo" | "cartaA";

/**
 * ResultadoRodada -- resultado publico da ultima Rodada resolvida (Story
 * 2.3/2.4), preenchido so quando `resolverRodada()` termina SEM empate.
 * Nested em `EstadoPartida.ultimoResultado`, nao um Schema de topo
 * separado -- mesmo padrao de `Rodada`.
 *
 * Sem `@view()`, de proposito: e informacao que todo Cliente ja viu
 * durante a revelacao (`Revelando`/`SuperTrunfoAcionado`), so reformatada
 * pro Chip de Resultado do frontend (UX-DR7) -- nao ha nada aqui que
 * precise de anti-cheat.
 */
export class ResultadoRodada extends Schema {
  /** Nome do Jogador vencedor (nunca o nome do carro, ver UX-DR7). */
  @type("string") vencedorNome: string = "";

  /**
   * Chave do Atributo decisivo (`atributos.ts`) -- frontend resolve o
   * rotulo. Vazio quando `tipoVitoria !== "atributo"` (Story 2.4: nao
   * houve comparacao de Atributo nenhuma).
   */
  @type("string") atributo: string = "";

  /** Story 2.4 -- ver `TipoVitoria`. Default "atributo" (fluxo normal). */
  @type("string") tipoVitoria: TipoVitoria = "atributo";
}
