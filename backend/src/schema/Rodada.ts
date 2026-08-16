import { ArraySchema, Schema, type, view } from "@colyseus/schema";
import { Carta } from "./Carta.ts";

/**
 * Rodada -- estado da rodada em andamento (AD-5, Story 2.2), forma exata
 * ja fechada em `epic-2-context.md` > Technical Decisions:
 * `{ jogadorDaVez, atributoSelecionado?, cartasEmDisputa: Carta[] }`.
 * Objeto nested em `EstadoPartida.rodadaAtual`, nao um Schema de topo
 * separado.
 *
 * `jogadorDaVez`/`atributoSelecionado` nao sao marcados com `@view()`:
 * ambos so ficam preenchidos (o segundo) ou tem sentido (o primeiro) a
 * partir do momento em que sao publicos por design -- `jogadorDaVez` e
 * sempre publico (equivalente ao antigo `EstadoPartida.jogadorDaVez`, ja
 * sem filtro desde a Story 2.1); `atributoSelecionado` so e preenchido no
 * mesmo instante em que `cartasEmDisputa` (revelacao simultanea,
 * epic-2-context.md > Requirements). `cartasEmDisputa` E marcada
 * (`@view()`, mesmo padrao de `Jogador.monte`) por postura padrao-segura:
 * mesmo sem nada lendo esse campo ainda (Story 2.2 concede a visibilidade
 * equivalente via `monte[0]`, nao via este campo), deixa-lo sem filtro
 * transmitiria os dados completos de todas as Cartas em disputa pra todo
 * Client assim que preenchido -- seguro por acidente, nao por design.
 */
export class Rodada extends Schema {
  /** sessionId do Jogador da vez (migrado de `EstadoPartida.jogadorDaVez`, Story 2.1). */
  @type("string") jogadorDaVez: string = "";

  /** Chave do Atributo escolhido nesta Rodada (`atributos.ts`) -- vazio ate `jogarCarta` ser aceito. */
  @type("string") atributoSelecionado: string = "";

  /**
   * Cartas do topo de cada Jogador ativo, na Rodada em disputa -- montada
   * por `PartidaRoom.jogarCarta` ao aceitar a selecao (Story 2.2). Copias
   * (mesmo valores) de `Jogador.monte[0]`, NUNCA a mesma instancia --
   * uma instancia de Schema so pode pertencer a um campo por vez;
   * reusa-la aqui corrompe a arvore de encoding e quebra o StateView de
   * `monte` pra outros Clients (ver `clonarCarta` em `PartidaRoom.ts`).
   * A visibilidade de `monte[0]` continua concedida separadamente, via
   * `client.view.add()` na instancia original.
   *
   * Marcado `@view()`: invisivel por padrao pra qualquer Client, ate
   * alguem conceder visibilidade explicitamente (`client.view.add()`) --
   * nenhuma Story ainda faz essa concessao especificamente pra este
   * campo (nao ha leitor no frontend), entao ele fica vazio/invisivel do
   * ponto de vista de qualquer cliente por enquanto, mesmo depois de
   * preenchido no estado canonico do servidor.
   */
  @view() @type([Carta]) cartasEmDisputa = new ArraySchema<Carta>();
}
