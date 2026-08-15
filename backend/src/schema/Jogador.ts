import { Schema, type } from "@colyseus/schema";

/**
 * Jogador -- um assento na Partida (humano ou IA), sincronizado pra todo
 * cliente conectado na `PartidaRoom` (Story 1.2).
 *
 * `sessionId` fica vazio pras vagas de IA (elas nunca conectam via rede,
 * ver `PartidaRoom.onCreate`); `isHost` so e verdadeiro pro primeiro
 * Jogador humano a entrar (o host, decisao ja fechada -- ver AD-5).
 */
export class Jogador extends Schema {
  @type("string") sessionId: string = "";
  @type("string") nome: string = "";
  @type("boolean") isHost: boolean = false;
  @type("boolean") isIA: boolean = false;
}
