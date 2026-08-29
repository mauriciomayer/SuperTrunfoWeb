import { useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { ATRIBUTOS, Carta, type CartaFrente } from "../components/Carta.tsx";
import { CartaVerso } from "../components/CartaVerso.tsx";
import { Funil } from "../components/Funil.tsx";
import { jogarCarta } from "../client/colyseusClient.ts";
import "./MesaDeJogo.css";

/**
 * Story 6.3 -- duracao (ms) que o Chip de Resultado fica visivel antes de
 * se esconder sozinho, client-side, sem prop/config nova (Boundaries
 * "Always"). Mesmo estilo de `DURACAO_REVELACAO_MS`/`PAUSA_IA_MS`
 * (`PartidaRoom.ts`), so que esta e' client-side, sem equivalente no
 * servidor -- ver `useEffect` do Chip de Resultado mais abaixo pro porque
 * de um timer sozinho (disparado por mudanca de VALOR) nao bastar.
 */
const DURACAO_CHIP_VISIVEL_MS = 3000;

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

/**
 * Forma de `EstadoPartida.funil` do lado do frontend (Story 2.5) -- espelha
 * `backend/src/schema/Funil.ts`. So a contagem publica
 * (`quantidadeCartasPresas`) chega aqui -- `cartasPresas` nunca e concedida
 * a nenhum Client (anti-cheat), entao nem faz sentido espelhar esse campo
 * do lado do frontend.
 */
interface FunilMesaCliente {
  quantidadeCartasPresas: number;
}

interface EstadoPartidaMesaCliente {
  jogadores: JogadorMesaCliente[];
  estado: string;
  rodadaAtual: RodadaMesaCliente;
  ultimoResultado?: ResultadoRodadaMesaCliente;
  funil?: FunilMesaCliente;
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
 * Chip "Eliminado" (Story 2.6, Boundaries "Always") -- substitui a Carta/
 * verso de QUALQUER assento (oponente OU o próprio) assim que
 * `quantidadeCartas === 0`. Mesmo Chip de Resultado (starburst,
 * `.chip-resultado`) usado pro resto da Mesa, so com a variante nova
 * `.chip-resultado--eliminado` (borda `--vermelho-eliminado`, ja existente
 * desde a Story 2.3). Nunca clicável -- nem envolvida em nenhum handler de
 * clique, ao contrário de `Carta` -- então mesmo se (por engano)
 * `souAVez` fosse `true` pra um assento eliminado, não haveria nada pra
 * clicar aqui.
 */
function ChipEliminado() {
  return (
    <div className="chip-resultado chip-resultado--eliminado" data-testid="chip-eliminado" role="status">
      <span className="chip-resultado__texto">Eliminado</span>
    </div>
  );
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
 * oponente, nunca um por Carta do Monte dele. Story 2.6: qualquer assento
 * (oponente ou o próprio) com `quantidadeCartas === 0` mostra o Chip
 * "Eliminado" no lugar, antes mesmo de checar `monte?.[0]`.
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

  // Story 6.3: flag local que controla a visibilidade do Chip de Resultado
  // -- SEPARADA do guard de `ultimoResultado.vencedorNome` ja existente (que
  // continua sendo o que esconde o Chip durante um empate, Story 2.5; ver
  // Boundaries "Always"). `estadoAnteriorRef` guarda o `estado.estado`
  // (STRING) do render anterior pra detectar TRANSICOES (nunca o valor
  // corrente sozinho, ver doc do `useEffect` abaixo). `timerEsconderChipRef`
  // segue o MESMO padrao ja estabelecido em `SalaDeEspera.tsx`
  // (`timerCopiadoRef`, Story 5.3): `useRef` pro id do timer, sempre
  // `clearTimeout`-ado antes de reagendar.
  const [mostrarChipResultado, setMostrarChipResultado] = useState(false);
  const estadoAnteriorRef = useRef<string | undefined>(undefined);
  const timerEsconderChipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Story 6.3: divida tecnica ja registrada (deferred-work.md, desde a
  // Story 5.1) -- `resolverRodada` (`PartidaRoom.ts`) so limpa
  // `ultimoResultado.vencedorNome`/`atributo` no branch de EMPATE; no branch
  // de vitoria normal, o valor so e' SOBRESCRITO quando a rodada seguinte
  // resolve, nunca voltando a vazio no meio do caminho. Um timer disparado
  // por "vencedorNome mudou de valor" e' fragil: duas rodadas seguidas com o
  // MESMO vencedor E o MESMO atributo gerariam o MESMO conteudo, sem
  // gatilho de reexibicao nenhum. Sinal robusto: a maquina de estados (AD-5)
  // NUNCA vai de "Revelando"/"SuperTrunfoAcionado" direto pra
  // "Revelando"/"SuperTrunfoAcionado" de novo -- sempre passa por
  // "AguardandoSelecao" (ou "FimDePartida") no meio. Rastrear a TRANSICAO
  // (nao o valor) de `estado.estado` garante um disparo por rodada,
  // independente do conteudo do resultado coincidir ou nao com o da rodada
  // anterior -- por isso a dependencia abaixo e' a STRING `estado?.estado`,
  // nunca o objeto `estado` inteiro (que muda de referencia a cada patch).
  useEffect(() => {
    const estadoAtual = estado?.estado;
    const estadoAnterior = estadoAnteriorRef.current;
    const entrandoEmRevelacao = estadoAtual === "Revelando" || estadoAtual === "SuperTrunfoAcionado";
    const saindoDeRevelacao = estadoAnterior === "Revelando" || estadoAnterior === "SuperTrunfoAcionado";
    const primeiraRenderizacao = estadoAnterior === undefined;

    if (entrandoEmRevelacao) {
      // Uma rodada NOVA comecando -- esconde o Chip IMEDIATAMENTE, mesmo
      // que o timer de ~3s da rodada anterior ainda nao tenha expirado
      // (cobre o jogador rapido que joga antes do timer expirar sozinho).
      if (timerEsconderChipRef.current !== null) {
        clearTimeout(timerEsconderChipRef.current);
        timerEsconderChipRef.current = null;
      }
      setMostrarChipResultado(false);
    } else if (saindoDeRevelacao || primeiraRenderizacao) {
      // A rodada acabou de resolver agora (saiu de Revelando/
      // SuperTrunfoAcionado) OU esta e' a 1a renderizacao com
      // `ultimoResultado` ja preenchido (`estadoAnteriorRef.current` ainda
      // `undefined`) -- tratada IGUAL a uma transicao de saida, preserva o
      // comportamento ja coberto pela suite (varios testes montam o
      // componente direto com `ultimoResultado` ja preenchido e esperam o
      // Chip visivel de imediato).
      if (timerEsconderChipRef.current !== null) {
        clearTimeout(timerEsconderChipRef.current);
      }
      setMostrarChipResultado(true);
      timerEsconderChipRef.current = setTimeout(() => {
        setMostrarChipResultado(false);
        timerEsconderChipRef.current = null;
      }, DURACAO_CHIP_VISIVEL_MS);
    }

    estadoAnteriorRef.current = estadoAtual;

    return () => {
      if (timerEsconderChipRef.current !== null) {
        clearTimeout(timerEsconderChipRef.current);
      }
    };
  }, [estado?.estado]);

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
  // `resolverRodada`, Story 2.3). Story 2.5: o gate extra de `estado ===
  // "Funil"` que existia aqui ficou obsoleto -- `resolverRodada` agora
  // LIMPA `ultimoResultado` (`vencedorNome = ""`) no proprio branch de
  // empate (`PartidaRoom.ts`), entao `vencedorNome` vazio ja basta pra
  // esconder o Chip durante um empate, sem checagem extra de `estado`
  // (que, alem disso, nunca chega a valer "Funil" do lado do Client -- ver
  // `Funil.tsx`/Design Notes do spec). Rotulo legivel do Atributo resolvido
  // via `ATRIBUTOS` (mesma tabela que a propria `Carta` usa, Story 2.2).
  //
  // Story 5.1: este Chip (SO este -- nunca o Chip "Eliminado" nem o Banner
  // de Vitoria de `FimDePartida.tsx`, que reusam a mesma classe base
  // `.chip-resultado`) ganha a classe `chip-resultado--overlay`
  // (`MesaDeJogo.css`, `position: fixed` centralizado) por ser renderizado
  // por ultimo no JSX, sem posicionamento fixo/sticky -- nascia abaixo da
  // dobra em qualquer viewport que nao coubesse tudo de uma vez, tornando o
  // resultado da Rodada invisivel na maioria das vezes.
  //
  // Story 6.3: `mostrarChipResultado` (`useEffect` acima) e' a camada
  // adicional que faz o Chip desaparecer sozinho apos
  // `DURACAO_CHIP_VISIVEL_MS` (ou imediatamente, ao entrar numa rodada
  // nova) -- a guarda de `vencedorNome` continua sendo o que esconde o Chip
  // durante um empate, as duas condicoes continuam necessarias.
  const ultimoResultado = estado?.ultimoResultado;
  const rotuloAtributoResultado = ATRIBUTOS.find(
    (atributo) => atributo.chave === ultimoResultado?.atributo,
  )?.rotulo;

  // Funil (Story 2.5): visivel sempre que `funil.quantidadeCartasPresas >
  // 0`, independente do `estado` atual (persiste durante toda a sequencia
  // de desempate, inclusive empates consecutivos) -- a propria `Funil.tsx`
  // ja se auto-esconde quando a contagem e 0, mas calcula aqui pra reusar
  // `nomeJogadorDaVez` (ja resolvido acima).
  const quantidadeCartasPresas = estado?.funil?.quantidadeCartasPresas ?? 0;

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
        {oponentes.map((oponente) => {
          const cartaTopoOponente = oponente.monte?.[0];
          return (
            <div
              className="mesa-de-jogo__oponente"
              // `sessionId` sozinho basta como key desde a Story 3.1 --
              // toda vaga de IA (declarada na criacao ou preenchida depois)
              // recebe um `sessionId` sintetico UNICO e estavel ("ia-N"),
              // nunca reatribuido. Um `isIA ? ... : ...` (como antes)
              // trocaria a key de um oponente humano assim que a Story 3.2
              // converter o assento dele pra IA no meio da Partida --
              // remontando o no DOM (perdendo qualquer transicao CSS em
              // andamento) exatamente no momento da desconexao, sem
              // necessidade nenhuma.
              key={oponente.sessionId}
            >
              {oponente.quantidadeCartas === 0 ? (
                <ChipEliminado />
              ) : cartaTopoOponente ? (
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

      <Funil quantidadeCartasPresas={quantidadeCartasPresas} nomeJogadorDaVez={nomeJogadorDaVez} />

      <div className="mesa-de-jogo__minha-carta">
        {meuJogador?.quantidadeCartas === 0 ? (
          <ChipEliminado />
        ) : minhaCartaTopo ? (
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
        {/* Story 5.8 (FR-32): mesma contagem que ja existe pro oponente
            (`.mesa-de-jogo__oponente-contagem` acima), so que sem nome ao
            lado -- o proprio Jogador ja sabe quem e ele. Fica FORA do
            condicional acima de proposito: precisa continuar visivel com o
            Chip "Eliminado", com a Carta revelada/virada, ou com "Preparando
            sua carta…", exatamente como a contagem do oponente ja e' sempre
            visivel fora do condicional dela (Boundaries "Always"). */}
        <span className="mesa-de-jogo__minha-contagem">
          {meuJogador?.quantidadeCartas ?? 0} carta{(meuJogador?.quantidadeCartas ?? 0) === 1 ? "" : "s"}
        </span>
      </div>

      {aguardandoSelecao && !souAVez && (
        <p className="mesa-de-jogo__aguardando" data-testid="aguardando-selecao">
          Aguardando {nomeJogadorDaVez ?? "o Jogador da vez"} escolher…
        </p>
      )}

      {ultimoResultado && ultimoResultado.vencedorNome && mostrarChipResultado && (
        <div
          className="chip-resultado chip-resultado--vitoria chip-resultado--overlay"
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
