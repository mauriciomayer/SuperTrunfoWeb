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
