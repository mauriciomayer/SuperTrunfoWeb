import { ArraySchema, Schema, type, view } from "@colyseus/schema";
import { Carta } from "./Carta.ts";

/**
 * Funil -- Cartas retidas por empate (Story 2.5), esvaziado assim que uma
 * Rodada de desempate finalmente resolve SEM empate (o vencedor leva tudo
 * junto com a Rodada em si, `PartidaRoom.resolverRodada`). Objeto nested em
 * `EstadoPartida.funil`, mesmo padrao de `Rodada`/`ResultadoRodada` -- nao
 * um Schema de topo separado.
 *
 * `cartasPresas` marcada `@view()`, mesma postura padrao-segura de
 * `Rodada.cartasEmDisputa`/`Jogador.monte`: ninguem precisa ver o conteudo
 * de uma Carta individual retida no Funil (nenhuma Story concede
 * visibilidade explicita pra este campo) -- fica vazio/invisivel do ponto
 * de vista de qualquer Client por design, mesmo depois de preenchido no
 * estado canonico do servidor.
 */
export class Funil extends Schema {
  @view() @type([Carta]) cartasPresas = new ArraySchema<Carta>();

  /**
   * Contagem publica de Cartas retidas no Funil -- pro Componente `Funil`
   * do frontend mostrar "🃏 Cartas presas no Funil (N)" sem precisar de
   * acesso a `cartasPresas` (que ninguem tem). Mantida em sincronia
   * manualmente sempre que `cartasPresas` mudar (mesmo padrao de
   * `Jogador.quantidadeCartas`).
   */
  @type("number") quantidadeCartasPresas: number = 0;
}
