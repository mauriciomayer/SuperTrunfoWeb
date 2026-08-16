import { ArraySchema, Schema, type } from "@colyseus/schema";
import { Jogador } from "./Jogador.ts";

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
   * Maquina de estados do game loop (AD-5, Story 2.1): comeca em
   * "AguardandoJogadores" (Sala de Espera) e so o handler
   * `iniciarPartida` da `PartidaRoom` a move pra "AguardandoSelecao".
   * Demais estados (`Revelando`, `ResolvendoRodada`, `Funil`,
   * `SuperTrunfoAcionado`, `FimDePartida`) chegam nas proximas Stories do
   * Epico 2 -- este campo so precisa existir e ser fiel ao estado atual,
   * nao validar as transicoes futuras.
   */
  @type("string") estado: EstadoPartidaFSM = "AguardandoJogadores";

  /** Jogador da vez (AD-5): sessionId. Setado pro host ao fim da distribuicao (Story 2.1). */
  @type("string") jogadorDaVez: string = "";
}
