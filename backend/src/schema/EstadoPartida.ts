import { ArraySchema, Schema, type } from "@colyseus/schema";
import { Jogador } from "./Jogador.ts";
import { Rodada } from "./Rodada.ts";
import { ResultadoRodada } from "./ResultadoRodada.ts";

/**
 * Estados nomeados da maquina de estados do game loop (AD-5). So os 2
 * primeiros existem de fato nesta Story (2.1); os demais chegam nas
 * proximas Stories do Epico 2 -- ja listados aqui pra todo codigo
 * TypeScript que atribui `EstadoPartida.estado` ganhar protecao de typo em
 * tempo de compilacao (o formato de rede continua `@type("string")`, sem
 * mudanca nenhuma na serializacao).
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
   * handler `jogarCarta` (Story 2.2) a move pra "Revelando" assim que o
   * Jogador da vez seleciona um Atributo valido. Demais estados
   * (`ResolvendoRodada`, `Funil`, `SuperTrunfoAcionado`, `FimDePartida`)
   * chegam nas proximas Stories do Epico 2 -- este campo so precisa
   * existir e ser fiel ao estado atual, nao validar as transicoes
   * futuras.
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
   * empate (com empate, `estado` vira "Funil" e este campo nao muda).
   * Frontend usa pro Chip de Resultado (UX-DR7): texto sempre presente,
   * nunca so cor. Sem `@view()` -- publico, ver `ResultadoRodada.ts`.
   */
  @type(ResultadoRodada) ultimoResultado = new ResultadoRodada();
}
