import { ArraySchema, Schema, type, view } from "@colyseus/schema";
import { Carta } from "./Carta.ts";

/**
 * Jogador -- um assento na Partida (humano ou IA), sincronizado pra todo
 * cliente conectado na `PartidaRoom` (Story 1.2).
 *
 * `sessionId` -- pra um humano, o `sessionId` de rede real do `Client`
 * (Colyseus). Vagas de IA nunca conectam via rede, mas NUNCA ficam com
 * `sessionId === ""` (default da classe) -- Story 3.1: cada assento de IA
 * recebe um `sessionId` sintetico UNICO e estavel (`"ia-N"`, atribuido em
 * `PartidaRoom.onCreate`/`aoReceberIniciarPartida`, os 2 pontos que criam
 * um `Jogador` de IA) assim que e criado. Achado da revisao (blind-hunter):
 * deixar todas as vagas de IA compartilhando o mesmo `""` colidia com o
 * sentinela de "nenhuma Super Trunfo jogada nesta Rodada"
 * (`rodadaAtual.superTrunfoJogadoPor !== ""` em `resolverRodada`) sempre
 * que uma IA jogava a propria Super Trunfo -- e tambem fazia qualquer
 * lookup por `sessionId` (vencedor de Rodada, Jogador da vez no frontend)
 * resolver pra QUALQUER Jogador de IA, nao necessariamente o certo, quando
 * havia 2+ vagas de IA. `isHost` so e verdadeiro pro primeiro Jogador
 * humano a entrar (o host, decisao ja fechada -- ver AD-5).
 */
export class Jogador extends Schema {
  @type("string") sessionId: string = "";
  @type("string") nome: string = "";
  @type("boolean") isHost: boolean = false;
  @type("boolean") isIA: boolean = false;

  /**
   * Monte do Jogador (Story 2.1, AD-3/AD-6): lista FIFO de Cartas -- indice
   * 0 e' sempre o topo (proxima a jogar); Cartas coletadas futuramente
   * entram no fim da lista (fundo). Convencao que vale pro resto do Epico 2
   * (Design Notes do spec da Story 2.1).
   *
   * Marcado `@view()`: por padrao esse array e' INVISIVEL pra qualquer
   * cliente, mesmo o proprio dono -- e' assim que o anti-cheat real (AD-3)
   * funciona (nunca so escondido na UI). O servidor concede visibilidade
   * so de elementos especificos via `client.view.add(carta)`/`.remove(carta)`
   * (StateView do `@colyseus/schema`); nesta historia, `PartidaRoom` so
   * concede a Carta do topo (`monte[0]`), e so pro cliente dono desse
   * Jogador (ver `PartidaRoom.onMessage("iniciarPartida", ...)`).
   */
  @view() @type([Carta]) monte = new ArraySchema<Carta>();

  /**
   * Contagem publica de Cartas no Monte -- Boundaries da Story 2.1: "a
   * contagem de Cartas no Monte (nao o conteudo) pode ser publica". Campo
   * comum (sem `@view()`), entao todo cliente ve, mesmo sem acesso
   * concedido a `monte`. Precisa ser mantida em sincronia manualmente
   * sempre que `monte` mudar (aqui, so na distribuicao inicial; qualquer
   * story futura que altere o Monte -- coleta de Cartas, Funil, etc. --
   * repete esse padrao).
   */
  @type("number") quantidadeCartas: number = 0;
}
