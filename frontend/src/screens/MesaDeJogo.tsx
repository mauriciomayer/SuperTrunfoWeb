import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { Carta, type CartaFrente } from "../components/Carta.tsx";
import { CartaVerso } from "../components/CartaVerso.tsx";
import "./MesaDeJogo.css";

/**
 * Forma do `Jogador`/`EstadoPartida` do lado do frontend -- espelha
 * `backend/src/schema/Jogador.ts`/`EstadoPartida.ts` de proposito (AD-10).
 *
 * `monte` e opcional e, quando presente, tem no maximo 1 elemento (a
 * Carta do topo) -- e exatamente o que o `StateView` do servidor concede
 * (AD-3, Story 2.1): nunca o Monte inteiro, nem pro proprio dono. Pra
 * qualquer outro Jogador (oponente), o campo nem chega a existir no
 * estado decodificado localmente (fica `undefined`) -- nunca `[]` cheio
 * de Cartas visiveis por engano.
 */
interface JogadorMesaCliente {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
  monte?: CartaFrente[];
  quantidadeCartas: number;
}

interface EstadoPartidaMesaCliente {
  jogadores: JogadorMesaCliente[];
  estado: string;
  jogadorDaVez: string;
}

interface MesaDeJogoProps {
  room: Room;
}

/**
 * Mesa de Jogo mínima (Story 2.1) -- só leitura: mostra a própria Carta do
 * topo (frente completa, `Carta.tsx`) e as Cartas dos oponentes como
 * Carta (verso, `CartaVerso.tsx`), uma por oponente -- nunca uma por Carta
 * do Monte dele (só a do topo importa visualmente, e nem essa aparece pra
 * quem não é o dono). Nenhuma seleção de Atributo ainda (Story 2.2);
 * `jogadorDaVez` só existe no estado por enquanto, sem uso visual aqui.
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

  return (
    <div className="mesa-de-jogo">
      <h1>Mesa de Jogo</h1>

      <div className="mesa-de-jogo__oponentes" data-testid="oponentes">
        {oponentes.map((oponente, indice) => (
          <div
            className="mesa-de-jogo__oponente"
            key={oponente.isIA ? `ia-${indice}` : oponente.sessionId}
          >
            <CartaVerso />
            <span className="mesa-de-jogo__oponente-nome">{oponente.nome}</span>
            <span className="mesa-de-jogo__oponente-contagem">
              {oponente.quantidadeCartas} carta{oponente.quantidadeCartas === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>

      <div className="mesa-de-jogo__minha-carta">
        {minhaCartaTopo ? (
          <Carta carta={minhaCartaTopo} />
        ) : (
          <p className="mesa-de-jogo__carregando">Preparando sua carta…</p>
        )}
      </div>
    </div>
  );
}
