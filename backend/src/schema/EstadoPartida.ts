import { ArraySchema, Schema, type } from "@colyseus/schema";
import { Jogador } from "./Jogador.ts";
import { Rodada } from "./Rodada.ts";
import { ResultadoRodada } from "./ResultadoRodada.ts";
import { Funil } from "./Funil.ts";

/**
 * Estados nomeados da maquina de estados do game loop (AD-5) -- listados
 * aqui pra todo codigo TypeScript que atribui `EstadoPartida.estado` ganhar
 * protecao de typo em tempo de compilacao (o formato de rede continua
 * `@type("string")`, sem mudanca nenhuma na serializacao).
 *
 * `"Funil"` (Story 2.5) e um caso especial dentro deste union: fica listado
 * so por fidelidade ao diagrama da FSM (`epic-2-context.md`), mas nenhum
 * codigo atribui `estado = "Funil"` de verdade -- a transicao de desempate
 * (`PartidaRoom.resolverRodada`) e inteiramente sincrona dentro do mesmo
 * callback (Design Notes do spec da Story 2.5): ao detectar empate, as
 * Cartas da Rodada vao pro Funil e `estado` volta DIRETO pra
 * "AguardandoSelecao", sem nunca passar por um valor intermediario visivel
 * em rede (sem StateView novo que dependa de um ciclo de rede aqui, ao
 * contrario de "Revelando"/"SuperTrunfoAcionado", que DEPENDEM de ficar
 * visiveis pra revelacao acontecer). `"ResolvendoRodada"`/`"FimDePartida"`
 * ainda chegam em Stories futuras do Epico 2 (2.6).
 */
export type EstadoPartidaFSM =
  | "AguardandoJogadores"
  | "AguardandoSelecao"
  | "Revelando"
  | "ResolvendoRodada"
  | "SuperTrunfoAcionado"
  | "Funil"
  | "FimDePartida";

/**
 * EstadoPartida -- estado canonico sincronizado da `PartidaRoom` (AD-1).
 *
 * Story 1.2 so precisa da base pra Sala de Espera: a lista de Jogadores
 * (humanos + IA) e os totais declarados pelo host na criacao (FR-5). O
 * resto do estado de jogo (Rodada, Funil, Baralho...) chega no Epico 2.
 */
export class EstadoPartida extends Schema {
  @type([Jogador]) jogadores = new ArraySchema<Jogador>();
  @type("number") totalJogadoresDeclarado: number = 0;
  @type("number") totalIADeclarado: number = 0;

  /**
   * Maquina de estados do game loop (AD-5): comeca em
   * "AguardandoJogadores" (Sala de Espera). O handler `iniciarPartida` da
   * `PartidaRoom` a move pra "AguardandoSelecao" (Story 2.1); dai, o
   * handler `jogarCarta` (Story 2.2) a move pra "Revelando"/
   * "SuperTrunfoAcionado" (Story 2.4) assim que o Jogador da vez joga uma
   * Carta. "Funil" nunca e atribuido de verdade (ver comentario de
   * `EstadoPartidaFSM` acima, Story 2.5). "ResolvendoRodada"/
   * "FimDePartida" ainda chegam em Stories futuras do Epico 2 (2.6) --
   * este campo so precisa existir e ser fiel ao estado atual, nao validar
   * as transicoes futuras.
   */
  @type("string") estado: EstadoPartidaFSM = "AguardandoJogadores";

  /**
   * Rodada em andamento (AD-5, Story 2.2): `jogadorDaVez`,
   * `atributoSelecionado` e `cartasEmDisputa` -- ver `schema/Rodada.ts`.
   * `jogadorDaVez` morava solto direto em `EstadoPartida` na Story 2.1
   * (antes de `rodadaAtual` existir); migrou pra dentro daqui porque e o
   * mesmo dado, na forma que o AD-5 ja tinha fechado desde o inicio.
   */
  @type(Rodada) rodadaAtual = new Rodada();

  /**
   * Resultado publico da ultima Rodada resolvida (Story 2.3) -- preenchido
   * so por `PartidaRoom.resolverRodada()` quando a comparacao termina SEM
   * empate. Story 2.5: com empate, o branch correspondente LIMPA este
   * campo (`vencedorNome`/`atributo` voltam pra `""`) em vez de deixa-lo
   * intocado -- sem isso o Chip de Resultado do frontend mostraria a
   * ultima vitoria de verdade (de uma Rodada anterior) como se fosse desta
   * Rodada empatada. `estado` tambem nao "vira Funil" nesse momento -- ele
   * volta DIRETO pra "AguardandoSelecao" dentro do mesmo callback sincrono
   * (ver comentario de `EstadoPartidaFSM` acima). Frontend usa pro Chip de
   * Resultado (UX-DR7): texto sempre presente, nunca so cor. Sem `@view()`
   * -- publico, ver `ResultadoRodada.ts`.
   */
  @type(ResultadoRodada) ultimoResultado = new ResultadoRodada();

  /**
   * Funil de desempate (Story 2.5) -- Cartas retidas por empate(s)
   * consecutivo(s) na Rodada em disputa, esvaziado assim que uma Rodada de
   * desempate resolve sem empate (o vencedor leva tudo, ver
   * `ResultadoRodada`/`Rodada` e `PartidaRoom.resolverRodada`). Objeto
   * nested, mesmo padrao de `rodadaAtual`/`ultimoResultado` -- ver
   * `schema/Funil.ts`.
   */
  @type(Funil) funil = new Funil();
}
