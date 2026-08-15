import { Room, type Client } from "colyseus";

/**
 * PartidaRoom -- Room minima do scaffolding (Story 1.1).
 *
 * Nesta historia ela so precisa aceitar conexoes de clientes para provar que
 * frontend e backend conversam via rede (AD-10). Nenhuma regra de jogo mora
 * aqui ainda -- isso comeca no Epico 2, quando esta Room ganha o schema de
 * `EstadoPartida` e a maquina de estados descrita em AD-5.
 */
export class PartidaRoom extends Room {
  // PRD: Partida suporta de 2 a 4 Jogadores totais.
  maxClients = 4;

  onCreate() {
    console.log(`[PartidaRoom] sala criada: ${this.roomId}`);
  }

  onJoin(client: Client) {
    console.log(`[PartidaRoom] cliente entrou: ${client.sessionId}`);
  }

  onLeave(client: Client) {
    console.log(`[PartidaRoom] cliente saiu: ${client.sessionId}`);
  }

  onDispose() {
    console.log(`[PartidaRoom] sala destruida: ${this.roomId}`);
  }
}
