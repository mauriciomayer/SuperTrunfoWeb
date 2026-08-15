import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { CriarSala } from "./screens/CriarSala.tsx";
import { EntrarSala } from "./screens/EntrarSala.tsx";
import { SalaDeEspera } from "./screens/SalaDeEspera.tsx";
import "./App.css";

/**
 * Extrai o `roomId` de um path `/sala/:roomId` (ex.: `/sala/abc123`).
 * Qualquer outro path (raiz incluida) nao casa -- comportamento atual
 * (`CriarSala`) e preservado (Matrix da Story 1.3: "URL sem /sala/").
 * Exportada pra ser testada isoladamente em `App.routing.test.ts`, sem
 * precisar montar o componente inteiro so pra cobrir a regex.
 */
export const ROTA_ENTRAR_SALA = /^\/sala\/([^/]+)\/?$/;

/**
 * Roteamento local minimo (sem lib de rotas -- decisao da Story 1.2,
 * reafirmada na 1.3): le `window.location.pathname` uma vez, no render,
 * pra decidir entre `CriarSala` (host, comportamento atual) e `EntrarSala`
 * (convidado, quando o path bate com `/sala/:roomId` -- Story 1.3) sempre
 * que `room` ainda e `null`. Depois que `room` existe (auto-join do host
 * via `criarSala`, ou join explicito do convidado via `entrarSala`), as
 * duas telas de entrada dao lugar a `SalaDeEspera`, que e a mesma pros
 * dois papeis (Story 1.2, sem mudanca de codigo).
 */
function App() {
  const [room, setRoom] = useState<Room | null>(null);

  const roomIdCapturado = ROTA_ENTRAR_SALA.exec(window.location.pathname)?.[1] ?? null;
  // `decodeURIComponent` -- o roomId pode chegar percent-encoded (ex.: link
  // colado a partir de um app de chat que escapa a URL); sem decodificar,
  // o `joinById` recebe um id que nunca bate com o real, gerando um "sala
  // não existe" desnecessário.
  const roomIdConvite = roomIdCapturado ? decodeURIComponent(roomIdCapturado) : null;

  return (
    <main className="app-shell">
      {room ? (
        <SalaDeEspera room={room} />
      ) : roomIdConvite ? (
        <EntrarSala roomId={roomIdConvite} onSalaEntrada={setRoom} />
      ) : (
        <CriarSala onSalaCriada={setRoom} />
      )}
    </main>
  );
}

export default App;
