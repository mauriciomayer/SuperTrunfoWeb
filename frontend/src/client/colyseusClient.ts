import { Client, type Room } from "@colyseus/sdk";

/**
 * Wrapper do `@colyseus/sdk` (Story 1.1 -- scaffolding).
 *
 * So sabe abrir uma conexao com o backend e entrar na Room de teste
 * (`partida`). Nenhuma logica de jogo mora aqui -- so a ponte de rede
 * entre `frontend/` e `backend/` (AD-10).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "ws://localhost:2567";

export function criarClienteColyseus(): Client {
  return new Client(BACKEND_URL);
}

/**
 * Conexao de teste: entra na `PartidaRoom` mínima subida pelo backend.
 * Usada pelo teste E2E (Playwright) pra provar que os dois pacotes
 * conversam via rede.
 */
export async function conectarNaSalaDeTeste(client: Client = criarClienteColyseus()): Promise<Room> {
  return client.joinOrCreate("partida");
}
