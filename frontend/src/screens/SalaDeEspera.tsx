import { useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { ListaSalaEspera, type JogadorSalaEspera } from "../components/ListaSalaEspera.tsx";
import { iniciarPartida } from "../client/colyseusClient.ts";
import "./SalaDeEspera.css";

const MIN_JOGADORES_PARA_INICIAR = 2;
// Tempo que o botao "Copiar link" fica mostrando a confirmacao "Copiado!"
// antes de reverter sozinho (Boundaries: "confirmacao temporaria... ex:
// 2000ms").
const TEMPO_CONFIRMACAO_COPIA_MS = 2000;

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
 * Story 1.4 fecha o loop: `onLeave` no backend agora remove o Jogador que
 * saiu de `state.jogadores`, e essa mesma reatividade (sem nenhum listener
 * novo) já cobre a lista encolhendo em tempo real. O botão "Iniciar" (só
 * pro host, habilitado com `jogadores.length >= 2`) dispara o intent
 * `iniciarPartida` -- só o disparo; a lógica de jogo em si é do Épico 2.
 */
export function SalaDeEspera({ room }: SalaDeEsperaProps) {
  const [, forcarAtualizacao] = useState(0);
  // Protege contra clique duplo (dois `iniciarPartida` disparados antes do
  // primeiro re-render) e falha silenciosa se `room.send` lancar (ex.:
  // conexao ja fechada) -- mesmo espirito do `criando`/`entrando` em
  // `CriarSala.tsx`/`EntrarSala.tsx`, so que sem "reverter" em caso de
  // erro: uma vez enviado, nao faz sentido deixar clicar de novo (Design
  // Notes: fire-and-forget, sem resposta esperada nesta historia).
  const [enviado, setEnviado] = useState(false);

  // Story 5.3: confirmacao visual temporaria do botao "Copiar link". Guarda
  // o id do `setTimeout` de reversao num ref (nao state) porque ele so
  // precisa ser lido/limpo dentro do proprio handler de clique, nunca
  // disparar re-render por si so -- limpar o timer anterior a cada novo
  // clique cobre o cenario de cliques repetidos da Matrix (sem isso, um
  // timer antigo poderia reverter o texto depois de um clique novo).
  const [copiado, setCopiado] = useState(false);
  const timerCopiadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Story 7.2: minha propria conexao (client-side) caiu de vez -- `onLeave`
  // so dispara quando o retry automatico do SDK ja esgotou (ou a queda nao
  // e reconectavel); `onError` cobre um erro mais direto. Nunca usa
  // `onDrop` (dispara na queda inicial, ainda reconectavel -- ver Design
  // Notes do spec, cobrir isso aqui mostraria o aviso cedo demais, durante
  // uma tentativa que ainda pode dar certo sozinha).
  const [conexaoPerdida, setConexaoPerdida] = useState(false);
  // Guarda "copia em andamento" num ref (nao state) pra ser lido/escrito de
  // forma sincrona no proprio handler -- evita a corrida de clique duplo em
  // que dois cliques disparam dois `writeText` sobrepostos e cada resolucao
  // agenda seu proprio `setTimeout`, com o segundo pisando em
  // `timerCopiadoRef.current` e orfanizando o timer do primeiro (que ainda
  // dispara sozinho, mas nao pode mais ser cancelado por um clique
  // seguinte).
  const copiandoRef = useRef(false);

  useEffect(() => {
    function aoMudarEstado() {
      forcarAtualizacao((tique) => tique + 1);
    }

    room.onStateChange(aoMudarEstado);

    return () => {
      room.onStateChange.remove(aoMudarEstado);
    };
  }, [room]);

  // Story 7.2: assina `onLeave`/`onError` (signals client-side do SDK,
  // independentes dos hooks de mesmo nome no servidor da Story 7.1) --
  // qualquer um dos dois indica que a conexao caiu de vez, sem mais
  // reconexao automatica em andamento.
  useEffect(() => {
    function aoPerderConexao(code: number, motivo?: string) {
      console.error(`[frontend] conexao da Sala de Espera caiu: ${code} ${motivo}`);
      setConexaoPerdida(true);
    }

    room.onLeave(aoPerderConexao);
    room.onError(aoPerderConexao);

    return () => {
      room.onLeave.remove(aoPerderConexao);
      room.onError.remove(aoPerderConexao);
    };
  }, [room]);

  // Limpa o timer pendente se o componente desmontar com a confirmacao
  // ainda ativa (ex: jogador sai da Sala de Espera logo apos copiar).
  useEffect(() => {
    return () => {
      if (timerCopiadoRef.current !== null) {
        clearTimeout(timerCopiadoRef.current);
      }
    };
  }, []);

  const estado = room.state as EstadoPartidaCliente | undefined;
  const jogadores = estado?.jogadores ?? [];
  const totalDeclarado = estado?.totalJogadoresDeclarado ?? 0;

  // Meu proprio Jogador na lista, achado por sessionId -- so ele pode ser
  // host (Boundaries: "achado por sessionId === room.sessionId"). Calculado
  // ANTES do guard de "Carregando" (Story 7.2): o aviso de conexao perdida
  // usa `souHost` pra decidir o texto certo, e esse aviso tem prioridade
  // sobre qualquer outro estado de render, inclusive "Carregando".
  const meuJogador = jogadores.find((jogador) => jogador.sessionId === room.sessionId);
  const souHost = meuJogador?.isHost ?? false;

  // Story 7.2: conexao caida de vez tem prioridade sobre qualquer outro
  // estado -- substitui a tela inteira, mesmo padrao visual `msg-box` de
  // `EntrarSala.tsx`. Texto generico o suficiente pra cobrir tanto
  // `onLeave` quanto `onError` (Matrix), diferenciado so por papel
  // (`souHost`).
  if (conexaoPerdida) {
    return (
      <div className="sala-de-espera">
        <div className="msg-box">
          <p className="msg-box-titulo" role="alert">
            Sua conexão com a sala caiu.
          </p>
          <p className="msg-box-subtitulo">
            {souHost
              ? "Crie uma nova sala pra continuar."
              : "Reabra o link de convite pra tentar entrar de novo."}
          </p>
        </div>
      </div>
    );
  }

  if (totalDeclarado === 0 || jogadores.length === 0) {
    return <p className="carregando">Carregando sala…</p>;
  }

  const linkConvite = `${window.location.origin}/sala/${room.roomId}`;

  // Story 5.3: copia `linkConvite` pra area de transferencia via Clipboard
  // API. Limpa o timer de reversao anterior ANTES de tentar copiar de novo
  // (cobre cliques repetidos, Matrix) e trata tanto rejeicao da Promise
  // quanto `navigator.clipboard` indisponivel (acessar `.writeText` de
  // `undefined` lanca sincronamente, capturado pelo mesmo try/catch por
  // estar dentro da expressao `await`) -- Boundaries: "sem crash, com algum
  // feedback... console.error no minimo".
  async function aoClicarCopiarLink() {
    // Um clique enquanto outro `writeText` ainda esta em voo e um no-op --
    // sem isso, as duas resolucoes sobrepostas agendariam dois timers e a
    // segunda pisaria na referencia da primeira (ver comentario do ref).
    if (copiandoRef.current) {
      return;
    }
    copiandoRef.current = true;

    if (timerCopiadoRef.current !== null) {
      clearTimeout(timerCopiadoRef.current);
      timerCopiadoRef.current = null;
    }

    try {
      await navigator.clipboard.writeText(linkConvite);
      setCopiado(true);
      timerCopiadoRef.current = setTimeout(() => {
        setCopiado(false);
        timerCopiadoRef.current = null;
      }, TEMPO_CONFIRMACAO_COPIA_MS);
    } catch (erroCopiar) {
      console.error("[frontend] falha ao copiar link da sala", erroCopiar);
      setCopiado(false);
    } finally {
      copiandoRef.current = false;
    }
  }

  const podeIniciar = jogadores.length >= MIN_JOGADORES_PARA_INICIAR;

  return (
    <div className="sala-de-espera">
      <h1>Sala de Espera</h1>
      <p className="subtitulo">
        Aguardando {jogadores.length} de {totalDeclarado} jogadores…
      </p>
      <div className="link-convite-linha">
        <p className="link-convite" data-testid="link-convite">
          {linkConvite} — envie esse link pros convidados
        </p>
        <button
          type="button"
          className="btn-copiar-link"
          onClick={aoClicarCopiarLink}
          aria-live="polite"
        >
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
      <ListaSalaEspera jogadores={jogadores} meuSessionId={room.sessionId} />
      {souHost && (
        <button
          type="button"
          className="btn-primario"
          disabled={!podeIniciar || enviado}
          onClick={() => {
            setEnviado(true);
            try {
              iniciarPartida(room);
            } catch (erroIniciar) {
              console.error("[frontend] falha ao iniciar partida", erroIniciar);
            }
          }}
        >
          Iniciar
        </button>
      )}
    </div>
  );
}
