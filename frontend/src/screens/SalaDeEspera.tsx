import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { ListaSalaEspera, type JogadorSalaEspera } from "../components/ListaSalaEspera.tsx";
import "./SalaDeEspera.css";

/**
 * Forma do `EstadoPartida` do lado do frontend -- espelha
 * `backend/src/schema/EstadoPartida.ts` de proposito (AD-10).
 */
interface EstadoPartidaCliente {
  jogadores: JogadorSalaEspera[];
  totalJogadoresDeclarado: number;
  totalIADeclarado: number;
}

interface SalaDeEsperaProps {
  room: Room;
}

/**
 * Sala de Espera mínima (Story 1.2): mostra o host + as vagas de IA já
 * preenchidas a partir do `room.state` no momento em que o host chega
 * (FR-5), e o link de convite baseado no `roomId`.
 *
 * O snapshot inicial de estado (`ROOM_STATE`) chega numa mensagem de rede
 * separada do handshake de entrada -- por isso assina `room.onStateChange`
 * em vez de ler `room.state` direto no primeiro render (poderia estar
 * vazio ainda). Isso NÃO é a UX de "lista crescendo ao vivo" da Story
 * 1.4 (que trata de outros Jogadores entrando depois); é só garantir que
 * o snapshot que já existe no momento da criação apareça corretamente.
 *
 * O Colyseus decodifica patches mutando a mesma instancia de `room.state`
 * em vez de trocar a referencia -- por isso o listener so incrementa um
 * contador local (nunca guarda o proprio `state` em `useState`, o que
 * faria o React descartar o re-render por "mesma referencia") e o render
 * le `room.state` direto, sempre com o valor mais recente.
 *
 * `room.state` ja existe (nao-nulo) assim que `criarSala()` resolve -- o
 * handshake de entrada cria a instancia com os campos zerados/vazios antes
 * do snapshot de verdade (`ROOM_STATE`) chegar. Esse snapshot pode chegar
 * ANTES ou DEPOIS do efeito abaixo se inscrever em `onStateChange` (corrida
 * real, nao so lentidao) -- por isso "carregando" nunca depende so do
 * evento ter disparado (podia ja ter disparado antes da inscricao,
 * travando pra sempre em "Carregando"); em vez disso e derivado do proprio
 * `room.state` a cada render. Alem disso, campos complexos (o array
 * `jogadores`, que referencia instancias `Jogador` a parte) podem decodir
 * em passos separados dos campos primitivos (`totalJogadoresDeclarado`) --
 * por isso cada campo tem seu proprio fallback (`?? []` / `?? 0`) em vez
 * de confiar que "um campo preenchido" implica "todos preenchidos" (bug
 * real encontrado em teste: `totalJogadoresDeclarado` já não-zero com
 * `jogadores` ainda `undefined` no meio da decodificacao, quebrando o
 * render). O listener so forca o re-render quando o snapshot chega DEPOIS
 * da inscricao.
 *
 * Não lida com convidados entrando pelo link (`entrarSala`, Story 1.3) e
 * não renderiza o botão "Iniciar" (Story 1.4) -- fora de escopo desta
 * história, ver Boundaries.
 */
export function SalaDeEspera({ room }: SalaDeEsperaProps) {
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

  const estado = room.state as EstadoPartidaCliente | undefined;
  const jogadores = estado?.jogadores ?? [];
  const totalDeclarado = estado?.totalJogadoresDeclarado ?? 0;

  if (totalDeclarado === 0 || jogadores.length === 0) {
    return <p className="carregando">Carregando sala…</p>;
  }

  const linkConvite = `${window.location.origin}/sala/${room.roomId}`;

  return (
    <div className="sala-de-espera">
      <h1>Sala de Espera</h1>
      <p className="subtitulo">
        Aguardando {jogadores.length} de {totalDeclarado} jogadores…
      </p>
      <p className="link-convite" data-testid="link-convite">
        {linkConvite} — envie esse link pros convidados
      </p>
      <ListaSalaEspera jogadores={jogadores} meuSessionId={room.sessionId} />
    </div>
  );
}
