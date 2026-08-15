import { ArraySchema, Schema, type } from "@colyseus/schema";
import { Jogador } from "./Jogador.ts";

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
}
