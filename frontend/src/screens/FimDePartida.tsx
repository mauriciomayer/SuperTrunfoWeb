import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import "./FimDePartida.css";

/**
 * Forma de `Jogador` do lado do frontend, so os campos que esta tela usa --
 * espelha `backend/src/schema/Jogador.ts` (AD-10). `quantidadeCartas` e
 * publico (sem `@view()`), entao chega igual pra todo Client, mesmo os
 * eliminados (0) e o vencedor (o Baralho inteiro).
 */
interface JogadorFimDePartidaCliente {
  sessionId: string;
  nome: string;
  quantidadeCartas: number;
}

interface EstadoPartidaFimDePartidaCliente {
  jogadores: JogadorFimDePartidaCliente[];
}

interface FimDePartidaProps {
  room: Room;
}

/**
 * Acha o vencedor pela MAIOR `quantidadeCartas` entre `jogadores` -- nunca
 * um `sessionId` fixo nem uma contagem hardcoded (Boundaries "Always": "N =
 * contagem real do vencedor, nunca hardcoded 32" -- Partidas com 3
 * Jogadores descartam 2 Cartas na distribuicao, AD-6, nunca chegam a 32).
 * `PartidaRoom.resolverRodada` (Story 2.6) so transiciona `estado` pra
 * "FimDePartida" quando exatamente 1 Jogador continua ativo, entao esse
 * `reduce` sempre acha um vencedor claro (sem empate possivel de
 * `quantidadeCartas`) assim que `jogadores` estiver preenchido.
 */
function acharVencedor(
  jogadores: JogadorFimDePartidaCliente[],
): JogadorFimDePartidaCliente | undefined {
  return jogadores.reduce<JogadorFimDePartidaCliente | undefined>((atual, jogador) => {
    if (!atual || jogador.quantidadeCartas > atual.quantidadeCartas) {
      return jogador;
    }
    return atual;
  }, undefined);
}

/**
 * Fim de Partida (Story 2.6) -- substitui `MesaDeJogo` (via `App.tsx`)
 * assim que `estado.estado === "FimDePartida"`. Banner de Vitoria (Chip de
 * Resultado como base, UX-DR7) + lista de todos os Jogadores com
 * `quantidadeCartas` + botao "Jogar Novamente" que navega pra `/`
 * (`window.location.href`, mesma filosofia "sem lib de rotas" ja
 * estabelecida -- nova Sala, sem preservar host/convidado).
 *
 * Mesmo padrao reativo das demais telas (`SalaDeEspera.tsx`/
 * `MesaDeJogo.tsx`): assina `room.onStateChange` e forca um re-render, sem
 * guardar `state` num `useState`.
 */
export function FimDePartida({ room }: FimDePartidaProps) {
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

  const estado = room.state as EstadoPartidaFimDePartidaCliente | undefined;
  const jogadores = estado?.jogadores ?? [];
  const vencedor = acharVencedor(jogadores);

  function aoClicarJogarNovamente() {
    // Sem lib de rotas (decisao ja fechada, Story 1.2/1.3) -- nova Sala do
    // zero, sem preservar papel de host/convidado nem `roomId` anterior.
    window.location.href = "/";
  }

  return (
    <div className="fim-de-partida">
      <h1>Fim de Partida</h1>

      {vencedor && (
        <div
          className="chip-resultado chip-resultado--vitoria"
          data-testid="banner-vitoria"
          role="status"
        >
          <span className="chip-resultado__texto">{vencedor.nome} venceu a partida!</span>
        </div>
      )}

      {vencedor && (
        <p className="fim-de-partida__resumo">
          Reuniu as {vencedor.quantidadeCartas} cartas do baralho
        </p>
      )}

      <ul className="fim-de-partida__lista" data-testid="lista-jogadores">
        {jogadores.map((jogador, indice) => (
          <li
            className="fim-de-partida__jogador"
            key={jogador.sessionId || `assento-${indice}`}
          >
            <span className="fim-de-partida__jogador-nome">{jogador.nome}</span>
            <span className="fim-de-partida__jogador-contagem">
              {jogador.quantidadeCartas} carta{jogador.quantidadeCartas === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-primario" onClick={aoClicarJogarNovamente}>
        Jogar Novamente
      </button>
    </div>
  );
}
