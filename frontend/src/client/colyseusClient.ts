import { Client, type Room } from "@colyseus/sdk";

/**
 * Ponte de rede unica entre `frontend/` e `backend/` (AD-10). Nenhuma
 * logica de jogo mora aqui -- so abertura de conexao e disparo dos
 * intents do contrato de mensagens (AD-1).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "ws://localhost:2567";

export function criarClienteColyseus(): Client {
  return new Client(BACKEND_URL);
}

/**
 * Intent `criarSala` (AD-1): cria uma `PartidaRoom` (AD-2) ja com o total
 * de Jogadores e a quantidade de IA declarados pelo host (FR-5). O
 * `client.create()` so resolve depois do auto-join do host completar --
 * por isso o `Room` retornado ja chega com o host e as vagas de IA no
 * `room.state.jogadores`.
 */
export async function criarSala(
  nome: string,
  totalJogadores: number,
  totalIA: number,
  client: Client = criarClienteColyseus(),
): Promise<Room> {
  return client.create("partida", { nome, totalJogadores, totalIA });
}

/**
 * Intent `entrarSala` (AD-1): leva a `joinById(roomId)` (AD-2) -- nunca
 * `joinOrCreate`/matchmaking generico, ja que entrar numa sala e sempre via
 * link de convite especifico daquela sala (RNF). Reaproveita o
 * `PartidaRoom.onJoin` (Story 1.2) sem nenhuma mudanca no backend: sala
 * inexistente e sala cheia (`maxClients`) ja sao rejeitadas nativamente
 * pelo matchmaking do Colyseus, rejeitando a promise retornada aqui.
 */
export async function entrarSala(
  nome: string,
  roomId: string,
  client: Client = criarClienteColyseus(),
): Promise<Room> {
  return client.joinById(roomId, { nome });
}

/**
 * Intent `iniciarPartida` (AD-1): so o host dispara, na Sala de Espera,
 * quando o minimo de 2 Jogadores totais e atingido (Story 1.4). Nesta
 * historia e so o disparo -- nao ha handler `onMessage("iniciarPartida",
 * ...)` no backend ainda (Epico 2), entao e fire-and-forget, sem resposta
 * esperada.
 */
export function iniciarPartida(room: Room): void {
  room.send("iniciarPartida");
}
