import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { ATRIBUTOS, Carta, type CartaFrente } from "../components/Carta.tsx";
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
 * porque `rodadaAtual` ainda nao existia). `superTrunfoJogadoPor` (Story
 * 2.4): sessionId de quem jogou a Super Trunfo nesta Rodada, vazio se nao
 * aplicavel -- usado so pro destaque visual da Carta "A" real vencedora
 * (ver `acharIndiceDaCartaAVencedora` abaixo).
 */
interface RodadaMesaCliente {
  jogadorDaVez: string;
  atributoSelecionado: string;
  superTrunfoJogadoPor?: string;
}

/**
 * Forma de `EstadoPartida.ultimoResultado` do lado do frontend (Story 2.3,
 * `tipoVitoria` desde a Story 2.4) -- espelha
 * `backend/src/schema/ResultadoRodada.ts`. So preenchido (`vencedorNome`
 * nao-vazio) depois que uma Rodada resolve SEM empate; usado pro Chip de
 * Resultado (UX-DR7). `tipoVitoria` decide qual das 3 variantes de texto
 * usar -- "atributo" (fluxo normal), "superTrunfo" (vitoria automatica sem
 * oposicao) ou "cartaA" (Super Trunfo anulado por uma Carta "A").
 */
interface ResultadoRodadaMesaCliente {
  vencedorNome: string;
  atributo: string;
  tipoVitoria?: string;
}

interface EstadoPartidaMesaCliente {
  jogadores: JogadorMesaCliente[];
  estado: string;
  rodadaAtual: RodadaMesaCliente;
  ultimoResultado?: ResultadoRodadaMesaCliente;
}

interface MesaDeJogoProps {
  room: Room;
}

/**
 * Story 2.4 -- durante `estado === "SuperTrunfoAcionado"`, replica no
 * frontend (AD-10: mirror de estado/logica, nunca import de codigo entre
 * pacotes backend/frontend) a MESMA busca circular do servidor
 * (`determinarVencedorSuperTrunfo`, `backend/src/game/superTrunfo.ts`) --
 * so pro destaque visual da Carta "A" real vencedora (`Carta.tsx`
 * `destacada`). Essa e a UNICA janela em que a Carta "A" ainda esta
 * visivel pra todo mundo (a mesma concessao de StateView da revelacao,
 * ver `PartidaRoom.aoReceberJogarCarta`) -- assim que `resolverRodada`
 * roda (Story 2.3, reaproveitado), a Carta jogada sai do topo de quem a
 * jogou e a visibilidade e revogada, entao esse destaque so pode ser
 * calculado ANTES disso, nunca a partir de `ultimoResultado` (que so e
 * preenchido depois que a Carta ja sumiu do estado local).
 *
 * Retorna o INDICE (em `jogadores`, nunca `sessionId`) do assento cuja
 * Carta deve ficar destacada, ou `undefined` se ninguem tem Carta "A"
 * (Super Trunfo vence sem oposicao, nada pra destacar). Achado de revisao
 * (edge-case-hunter): `Jogador.sessionId` fica `""` pra TODO assento de IA
 * (`Jogador.ts`) -- devolver `sessionId` aqui faria QUALQUER assento de IA
 * "empatar" com o vencedor de verdade quando ele proprio e' uma IA (todos
 * compartilham `""`), destacando mais de uma Carta ao mesmo tempo. Indice
 * e' sempre unico por assento, mesmo entre varias IAs.
 */
function acharIndiceDaCartaAVencedora(
  jogadores: JogadorMesaCliente[],
  superTrunfoJogadoPor: string,
): number | undefined {
  const indiceDoSuperTrunfo = jogadores.findIndex(
    (jogador) => jogador.sessionId === superTrunfoJogadoPor,
  );
  if (indiceDoSuperTrunfo === -1) return undefined;

  const total = jogadores.length;
  for (let passo = 1; passo < total; passo++) {
    const indice = (indiceDoSuperTrunfo + passo) % total;
    if (jogadores[indice].monte?.[0]?.letra === "A") {
      return indice;
    }
  }
  return undefined;
}

/**
 * Story 2.4 -- texto do Chip de Resultado (UX-DR7), uma variante por
 * `tipoVitoria` (Boundaries "Always": "variantes diferentes de texto pra
 * cada caso, nunca so a cor dourada"). `rotuloAtributo` so e usado na
 * variante "atributo" (fluxo normal, Story 2.3); as duas variantes de
 * Super Trunfo nunca mencionam Atributo (nao houve comparacao nenhuma).
 */
function textoChipResultado(
  resultado: ResultadoRodadaMesaCliente,
  rotuloAtributo: string | undefined,
): string {
  if (resultado.tipoVitoria === "superTrunfo") {
    return `${resultado.vencedorNome} venceu com a Super Trunfo!`;
  }
  if (resultado.tipoVitoria === "cartaA") {
    return `${resultado.vencedorNome} anulou a Super Trunfo com uma Carta "A"!`;
  }
  return `${resultado.vencedorNome} venceu a rodada com ${rotuloAtributo ?? resultado.atributo}`;
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

  // Story 2.3: destaca a Linha do Atributo selecionado em TODAS as Cartas
  // visiveis so durante "Revelando" (Code Map) -- fora disso,
  // `atributoSelecionado` ja esta vazio (limpo por `resolverRodada` ao
  // resolver sem empate) ou nao tem sentido mostrar (antes da 1a selecao).
  const revelando = estado?.estado === "Revelando";
  const atributoDestacado = revelando ? estado?.rodadaAtual?.atributoSelecionado : undefined;

  // Story 2.4: durante "SuperTrunfoAcionado" (nunca "Revelando" pra essa
  // Carta, Boundaries "Always"), destaca a Carta "A" que anula o Super
  // Trunfo como "a vencedora real" (UX) -- ver
  // `acharIndiceDaCartaAVencedora` acima pro porque desse calculo precisar
  // acontecer AGORA (nao a partir de `ultimoResultado`) e ser por INDICE
  // (nao `sessionId`, ambiguo entre assentos de IA).
  const superTrunfoAcionado = estado?.estado === "SuperTrunfoAcionado";
  const indiceCartaAVencedora = superTrunfoAcionado
    ? acharIndiceDaCartaAVencedora(jogadores, estado?.rodadaAtual?.superTrunfoJogadoPor ?? "")
    : undefined;
  // Indice de CADA assento dentro de `jogadores` (join order) -- `indexOf`
  // funciona por identidade de referencia, e `oponentes`/`meuJogador`
  // (abaixo) sao derivados de `jogadores` via `find`/`filter`, entao
  // apontam pras MESMAS instancias, nunca copias.
  function ehAssentoCartaAVencedora(jogador: JogadorMesaCliente): boolean {
    return indiceCartaAVencedora !== undefined && jogadores.indexOf(jogador) === indiceCartaAVencedora;
  }

  // Chip de Resultado (UX-DR7): so aparece depois que uma Rodada resolve
  // SEM empate (`ultimoResultado.vencedorNome` preenchido por
  // `resolverRodada`, Story 2.3). Achado da revisao do diff: `estado ===
  // "Funil"` precisa ficar de fora explicitamente -- `ultimoResultado`
  // continua com o valor da ULTIMA Rodada que resolveu sem empate (o
  // schema nao limpa esse campo ao entrar em Funil), entao sem essa
  // checagem o Chip da Rodada ANTERIOR continuaria na tela durante um
  // empate, dando a entender (errado) que a Rodada atual ja tem vencedor
  // quando na verdade ela travou (Story 2.5 resolve o Funil de verdade).
  // Rotulo legivel do Atributo resolvido via `ATRIBUTOS` (mesma tabela que
  // a propria `Carta` usa, Story 2.2).
  const ultimoResultado = estado?.estado !== "Funil" ? estado?.ultimoResultado : undefined;
  const rotuloAtributoResultado = ATRIBUTOS.find(
    (atributo) => atributo.chave === ultimoResultado?.atributo,
  )?.rotulo;

  // Story 2.4: `atributo` fica ausente quando quem clicou foi a Carta
  // Super Trunfo inteira (`Carta.tsx` chama sem argumento nesse caso,
  // nunca uma Linha de Atributo) -- `jogarCarta` (colyseusClient.ts) ja
  // aceita `atributo` opcional, o servidor ignora o campo de qualquer
  // jeito pra essa Carta.
  function aoSelecionarAtributo(atributo?: string) {
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
              {cartaTopoOponente ? (
                <Carta
                  carta={cartaTopoOponente}
                  atributoDestacado={atributoDestacado}
                  destacada={ehAssentoCartaAVencedora(oponente)}
                />
              ) : (
                <CartaVerso />
              )}
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
            atributoDestacado={atributoDestacado}
            destacada={meuJogador !== undefined && ehAssentoCartaAVencedora(meuJogador)}
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

      {ultimoResultado && ultimoResultado.vencedorNome && (
        <div
          className="chip-resultado chip-resultado--vitoria"
          data-testid="chip-resultado"
          role="status"
        >
          <span className="chip-resultado__texto">
            {textoChipResultado(ultimoResultado, rotuloAtributoResultado)}
          </span>
        </div>
      )}
    </div>
  );
}
