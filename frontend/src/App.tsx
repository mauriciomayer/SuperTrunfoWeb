import { useEffect, useState } from "react";
import { conectarNaSalaDeTeste } from "./client/colyseusClient.ts";
import "./App.css";

type StatusConexao = "conectando" | "conectado" | "erro";

/**
 * Pagina de scaffolding (Story 1.1).
 *
 * Nao e uma tela real do jogo (isso e o resto do Epico 1) -- so abre a
 * conexao de teste com o backend via `@colyseus/sdk` (AD-10) e mostra o
 * resultado, servindo de alvo pro teste E2E (Playwright).
 */
function App() {
  const [status, setStatus] = useState<StatusConexao>("conectando");

  useEffect(() => {
    let cancelado = false;

    conectarNaSalaDeTeste()
      .then((room) => {
        if (cancelado) {
          room.leave();
          return;
        }
        setStatus("conectado");
        room.leave();
      })
      .catch((erro) => {
        console.error("[frontend] falha ao conectar no backend", erro);
        if (!cancelado) setStatus("erro");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <main>
      <h1>Super Trunfo Web</h1>
      <p>Scaffolding do projeto (Story 1.1) -- sem telas de jogo ainda.</p>
      <p data-testid="status-conexao">
        Status da conexao de teste com o backend: <strong>{status}</strong>
      </p>
    </main>
  );
}

export default App;
