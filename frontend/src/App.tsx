import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { CriarSala } from "./screens/CriarSala.tsx";
import { EntrarSala } from "./screens/EntrarSala.tsx";
import { SalaDeEspera } from "./screens/SalaDeEspera.tsx";
import { MesaDeJogo } from "./screens/MesaDeJogo.tsx";
import { FimDePartida } from "./screens/FimDePartida.tsx";
import { FAQ } from "./screens/FAQ.tsx";
import "./App.css";

/** Estado inicial de `EstadoPartida.estado` (espelha o default do backend, AD-10). */
const ESTADO_AGUARDANDO_JOGADORES = "AguardandoJogadores";
/** Estado final da maquina de estados do game loop (Story 2.6, AD-10). */
const ESTADO_FIM_DE_PARTIDA = "FimDePartida";

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
 *
 * Story 2.1: uma vez com `room`, `SalaDeEspera` da lugar a `MesaDeJogo`
 * assim que `room.state.estado` deixa de ser `"AguardandoJogadores"` (o
 * host clicou "Iniciar" e o backend distribuiu o Baralho -- ver
 * `PartidaRoom.ts`). Mesmo padrao reativo ja estabelecido em
 * `SalaDeEspera.tsx`/`MesaDeJogo.tsx`: assina `room.onStateChange` aqui
 * tambem (listener independente, o Colyseus suporta varios) so pra essa
 * decisao de roteamento reagir em tempo real, sem guardar `state` num
 * `useState` (mesma razao: o Colyseus muta a mesma instancia).
 *
 * Story 2.6: `estado === "FimDePartida"` renderiza `FimDePartida` --
 * checado ANTES do fallback pra `MesaDeJogo` (Boundaries "Always"), ja que
 * "FimDePartida" tambem "nao e AguardandoJogadores" e cairia no fallback
 * errado se checado depois.
 *
 * Story 4.1: `mostrarFAQ` e um toggle de estado local, so relevante dentro
 * do branch onde `room` ainda e `null` e nao ha `roomIdConvite` (o branch
 * que hoje renderiza `CriarSala`) -- mesma filosofia "sem lib de rotas",
 * nenhuma mudanca em `window.location`. Com `mostrarFAQ` true, `FAQ`
 * aparece visualmente no lugar de `CriarSala` -- mas `CriarSala` continua
 * MONTADA por baixo (so escondida via CSS, ver `.app-shell__oculto`), pra
 * que o `useState` interno dela (nome/totalJogadores/totalIA) sobreviva a
 * ida e volta pra FAQ (Matrix "Abrir a FAQ": "formulario preenchido ate
 * entao nao e perdido" -- desmontar/remontar perderia esse estado mesmo
 * sem nenhum reload de pagina). Nunca alcancavel com `room` != null nem
 * via `roomIdConvite` (Boundaries "Never": a FAQ nunca aparece em
 * SalaDeEspera/MesaDeJogo/FimDePartida).
 */
function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [, forcarAtualizacao] = useState(0);
  const [mostrarFAQ, setMostrarFAQ] = useState(false);

  useEffect(() => {
    if (!room) return;

    function aoMudarEstado() {
      forcarAtualizacao((tique) => tique + 1);
    }

    room.onStateChange(aoMudarEstado);

    return () => {
      room.onStateChange.remove(aoMudarEstado);
    };
  }, [room]);

  const roomIdCapturado = ROTA_ENTRAR_SALA.exec(window.location.pathname)?.[1] ?? null;
  // `decodeURIComponent` -- o roomId pode chegar percent-encoded (ex.: link
  // colado a partir de um app de chat que escapa a URL); sem decodificar,
  // o `joinById` recebe um id que nunca bate com o real, gerando um "sala
  // não existe" desnecessário.
  const roomIdConvite = roomIdCapturado ? decodeURIComponent(roomIdCapturado) : null;

  // `room.state` pode ainda nao ter chegado (snapshot inicial e uma
  // mensagem de rede separada, mesma corrida documentada em
  // `SalaDeEspera.tsx`) -- ate la, o fallback e o proprio default do
  // backend (`AguardandoJogadores`), entao a Sala de Espera continua
  // sendo a tela certa nesse intervalo.
  const estadoPartida =
    (room?.state as { estado?: string } | undefined)?.estado ?? ESTADO_AGUARDANDO_JOGADORES;

  return (
    <main className="app-shell">
      {room ? (
        estadoPartida === ESTADO_AGUARDANDO_JOGADORES ? (
          <SalaDeEspera room={room} />
        ) : estadoPartida === ESTADO_FIM_DE_PARTIDA ? (
          <FimDePartida room={room} />
        ) : (
          <MesaDeJogo room={room} />
        )
      ) : roomIdConvite ? (
        <EntrarSala roomId={roomIdConvite} onSalaEntrada={setRoom} />
      ) : (
        <>
          {/* `CriarSala` fica sempre montada neste branch (nunca desmonta
              quando `mostrarFAQ` liga) -- so escondida via CSS
              (`display: none`, tambem tira do foco/leitura de tela) --
              pra preservar de verdade o `useState` interno dela
              (nome/totalJogadores/totalIA, Matrix "Abrir a FAQ": "formulario
              preenchido ate entao nao e perdido"). Desmontar e remontar
              perderia esse estado local mesmo sem nenhum reload de pagina.
              `data-testid` so pra teste (achado do code review: nenhuma
              suite provava que a classe de esconder era aplicada/removida
              no lugar certo -- `getByRole`/`queryByRole` acham elementos no
              DOM independente de `display: none`, entao um ternario
              invertido passaria batido sem essa asserção direta na classe). */}
          <div
            className={mostrarFAQ ? "app-shell__oculto" : undefined}
            data-testid="wrapper-criar-sala"
          >
            <CriarSala
              onSalaCriada={setRoom}
              onAbrirFAQ={() => setMostrarFAQ(true)}
              mostrarFAQ={mostrarFAQ}
            />
          </div>
          {mostrarFAQ && <FAQ onVoltar={() => setMostrarFAQ(false)} />}
        </>
      )}
    </main>
  );
}

export default App;
