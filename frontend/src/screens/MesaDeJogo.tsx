import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { Carta, type CartaFrente } from "../components/Carta.tsx";
import { CartaVerso } from "../components/CartaVerso.tsx";
import { jogarCarta } from "../client/colyseusClient.ts";
import "./MesaDeJogo.css";

/**
 * Forma do `Jogador`/`EstadoPartida` do lado do frontend -- espelha
 * `backend/src/schema/Jogador.ts`/`EstadoPartida.ts` de proposito (AD-10).
 *
 * `monte` e opcional e, quando presente, tem no maximo 1 elemento (a
 * Carta do topo) -- e exatamente o que o `StateView` do servidor concede
 * (AD-3, Story 2.1/2.2): nunca o Monte inteiro. Ate a Story 2.1, so o
 * proprio dono recebia isso; a partir da Story 2.2, ao entrar em
 * "Revelando", o servidor concede a mesma Carta do topo pra TODO mundo --
 * entao `monte` pode chegar preenchido pra um oponente tambem, e e
 * exatamente esse sinal que decide mostrar `Carta` (frente) em vez de
 * `CartaVerso` pra ele (nunca uma decisao de "estamos em Revelando"
 * tomada aqui, so reflete o que ja chegou no estado local).
 */
interface JogadorMesaCliente {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
  monte?: CartaFrente[];
  quantidadeCartas: number;
}

/**
 * Forma de `EstadoPartida.rodadaAtual` do lado do frontend (Story 2.2) --
 * espelha `backend/src/schema/Rodada.ts`. `jogadorDaVez` migrou de
 * `EstadoPartida` direto pra dentro daqui (Story 2.1 colocava solto
 * porque `rodadaAtual` ainda nao existia).
 */
interface RodadaMesaCliente {
  jogadorDaVez: string;
  atributoSelecionado: string;
}

interface EstadoPartidaMesaCliente {
  jogadores: JogadorMesaCliente[];
  estado: string;
  rodadaAtual: RodadaMesaCliente;
}

interface MesaDeJogoProps {
  room: Room;
}

/**
 * Mesa de Jogo (Story 2.2) -- mostra a própria Carta do topo (frente
 * completa, `Carta.tsx`), com a Linha de Atributo clicável só na própria
 * vez (`estado === "AguardandoSelecao"` e `rodadaAtual.jogadorDaVez ===
 * room.sessionId`); clique dispara `jogarCarta` (AD-1). Fora da própria
 * vez, mostra "Aguardando {nome} escolher…" (Padrões de Estado). Cada
 * oponente aparece como `Carta` (frente) assim que `monte?.[0]` existir
 * no estado local (revelação concedida pelo servidor via `StateView`,
 * Story 2.2) -- senão, continua como `CartaVerso` (verso), um por
 * oponente, nunca um por Carta do Monte dele.
 *
 * Mesmo padrão reativo de `SalaDeEspera.tsx`: assina `room.onStateChange`
 * e força um re-render, sem guardar `state` num `useState` (o Colyseus
 * decodifica patches mutando a mesma instância de `room.state`).
 */
export function MesaDeJogo({ room }: MesaDeJogoProps) {
  const [, forcarAtualizacao] = useState(0);

  useEffect(() => {
    function aoMudarEstado() {
      forcarAtualizacao((tique) => tique + 1);
    }

    room.onStateChange(aoMudarEstado);

    return () => {
      room.onStateChange.remove(aoMudarEstado);
    };
  }, [room]);

  const estado = room.state as EstadoPartidaMesaCliente | undefined;
  const jogadores = estado?.jogadores ?? [];
  const meuJogador = jogadores.find((jogador) => jogador.sessionId === room.sessionId);
  const oponentes = jogadores.filter((jogador) => jogador.sessionId !== room.sessionId);
  const minhaCartaTopo = meuJogador?.monte?.[0];

  const jogadorDaVez = estado?.rodadaAtual?.jogadorDaVez ?? "";
  const souAVez = jogadorDaVez !== "" && jogadorDaVez === room.sessionId;
  const aguardandoSelecao = estado?.estado === "AguardandoSelecao";
  const nomeJogadorDaVez = jogadores.find((jogador) => jogador.sessionId === jogadorDaVez)?.nome;

  function aoSelecionarAtributo(atributo: string) {
    jogarCarta(room, atributo);
  }

  return (
    <div className="mesa-de-jogo">
      <h1>Mesa de Jogo</h1>

      <div className="mesa-de-jogo__oponentes" data-testid="oponentes">
        {oponentes.map((oponente, indice) => {
          const cartaTopoOponente = oponente.monte?.[0];
          return (
            <div
              className="mesa-de-jogo__oponente"
              key={oponente.isIA ? `ia-${indice}` : oponente.sessionId}
            >
              {cartaTopoOponente ? <Carta carta={cartaTopoOponente} /> : <CartaVerso />}
              <span className="mesa-de-jogo__oponente-nome">{oponente.nome}</span>
              <span className="mesa-de-jogo__oponente-contagem">
                {oponente.quantidadeCartas} carta{oponente.quantidadeCartas === 1 ? "" : "s"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mesa-de-jogo__minha-carta">
        {minhaCartaTopo ? (
          <Carta
            carta={minhaCartaTopo}
            clicavel={aguardandoSelecao && souAVez}
            onSelecionarAtributo={aoSelecionarAtributo}
          />
        ) : (
          <p className="mesa-de-jogo__carregando">Preparando sua carta…</p>
        )}
      </div>

      {aguardandoSelecao && !souAVez && (
        <p className="mesa-de-jogo__aguardando" data-testid="aguardando-selecao">
          Aguardando {nomeJogadorDaVez ?? "o Jogador da vez"} escolher…
        </p>
      )}
    </div>
  );
}
