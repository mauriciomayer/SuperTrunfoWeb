import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { CriarSala } from "./screens/CriarSala.tsx";
import { SalaDeEspera } from "./screens/SalaDeEspera.tsx";
import "./App.css";

/**
 * Roteamento local minimo (Story 1.2): sem lib de rotas, fluxo linear
 * Criar Sala -> Sala de Espera guiado por estado local -- substitui a
 * pagina placeholder de conexao de teste da Story 1.1. Rota de URL real
 * (`/sala/:roomId`) pra convidados fica pra Story 1.3.
 */
function App() {
  const [room, setRoom] = useState<Room | null>(null);

  return (
    <main className="app-shell">
      {room ? <SalaDeEspera room={room} /> : <CriarSala onSalaCriada={setRoom} />}
    </main>
  );
}

export default App;
