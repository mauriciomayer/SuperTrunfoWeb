import { Schema, type } from "@colyseus/schema";

/**
 * ResultadoRodada -- resultado publico da ultima Rodada resolvida (Story
 * 2.3), preenchido so quando `resolverRodada()` termina SEM empate.
 * Nested em `EstadoPartida.ultimoResultado`, nao um Schema de topo
 * separado -- mesmo padrao de `Rodada`.
 *
 * Sem `@view()`, de proposito: e informacao que todo Cliente ja viu
 * durante a revelacao (`Revelando`), so reformatada pro Chip de Resultado
 * do frontend (UX-DR7) -- nao ha nada aqui que precise de anti-cheat.
 */
export class ResultadoRodada extends Schema {
  /** Nome do Jogador vencedor (nunca o nome do carro, ver UX-DR7). */
  @type("string") vencedorNome: string = "";

  /** Chave do Atributo decisivo (`atributos.ts`) -- frontend resolve o rotulo. */
  @type("string") atributo: string = "";
}
