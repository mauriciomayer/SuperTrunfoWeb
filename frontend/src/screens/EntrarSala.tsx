import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { entrarSala } from "../client/colyseusClient.ts";
import "./EntrarSala.css";

interface MensagemErro {
  titulo: string;
  subtitulo: string;
}

// Titulo em negrito + subtitulo secundario menor, igual ao `msg-box` do
// mockup `key-entrar-sala.html` (que mostra "Esta sala já está cheia." +
// uma segunda linha de orientação, cor/tamanho reduzidos).
const MENSAGEM_SALA_INEXISTENTE: MensagemErro = {
  titulo: "Esta sala não existe mais.",
  subtitulo: "Peça pro host um novo link.",
};
const MENSAGEM_SALA_CHEIA: MensagemErro = {
  titulo: "Esta sala já está cheia.",
  subtitulo: "Peça pro host criar uma nova sala se quiser jogar.",
};
const MENSAGEM_GENERICA: MensagemErro = {
  titulo: "Não foi possível entrar nessa sala.",
  subtitulo: "Peça pro host um novo link.",
};

interface EntrarSalaProps {
  roomId: string;
  onSalaEntrada: (room: Room) => void;
}

/**
 * Entrar na Sala -- tela do convidado (Story 1.3), aberta a partir do link
 * de convite (`/sala/:roomId`, roteado em `App.tsx`) que a Sala de Espera
 * da Story 1.2 exibe. So pede o nome (sem steppers -- quem declara
 * `totalJogadores`/`totalIA` e o host, na criacao) e dispara o intent
 * `entrarSala` via `client.joinById(roomId, { nome })` (AD-2), nunca
 * matchmaking generico. Reaproveita o `PartidaRoom.onJoin` da Story 1.2 sem
 * nenhuma mudanca no backend.
 *
 * Nao mostra o nome do host antes de entrar (o mockup `key-entrar-sala.html`
 * tem uma linha "Você foi convidado pra sala de X", mas isso exigiria um
 * mecanismo novo de metadata/preview de Room fora do contrato de mensagens
 * fechado da AD-1 -- fora de escopo, ver Boundaries do spec).
 *
 * Ao falhar (sala inexistente ou cheia), substitui o formulario inteiro por
 * uma mensagem -- diferente do padrao inline (`role="alert"` dentro do
 * card) usado em `CriarSala` -- porque e assim que o mockup desenha o
 * estado de erro (`msg-box` isolado, sem card de formulario; ver Design
 * Notes do spec).
 */
export function EntrarSala({ roomId, onSalaEntrada }: EntrarSalaProps) {
  const [nome, setNome] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<MensagemErro | null>(null);

  const nomeValido = nome.trim().length > 0;

  async function handleEntrarSala() {
    if (!nomeValido || entrando) return;

    setEntrando(true);

    try {
      const room = await entrarSala(nome.trim(), roomId);
      onSalaEntrada(room);
    } catch (erroEntrada) {
      console.error("[frontend] falha ao entrar na sala", erroEntrada);
      setErro(mensagemDeErro(erroEntrada));
      setEntrando(false);
    }
  }

  if (erro) {
    return (
      <div className="entrar-sala">
        <h1 className="wordmark">Super Trunfo</h1>
        <div className="msg-box">
          {/* `role="alert"` só no título -- é o texto que a Matrix/AC exigem
              ("mensagem clara"); o subtítulo é só orientação complementar,
              não precisa ser o que a asserção de acessibilidade verifica. */}
          <p className="msg-box-titulo" role="alert">
            {erro.titulo}
          </p>
          <p className="msg-box-subtitulo">{erro.subtitulo}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="entrar-sala">
      <h1 className="wordmark">Super Trunfo</h1>

      <form
        className="card"
        onSubmit={(evento) => {
          evento.preventDefault();
          handleEntrarSala();
        }}
      >
        <div className="campo">
          <label htmlFor="nome-convidado">Seu nome</label>
          <input
            id="nome-convidado"
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Digite seu nome"
          />
        </div>

        <button type="submit" className="btn-primario" disabled={!nomeValido || entrando}>
          {entrando ? "Entrando…" : "Entrar na Sala"}
        </button>
      </form>
    </div>
  );
}

/**
 * Distingue "sala inexistente" de "sala cheia" a partir da mensagem que o
 * `joinById` do servidor Colyseus rejeita: o matchmaker (`MatchMaker.ts`,
 * nao alterado por este story) lanca `room "${roomId}" not found` quando o
 * roomId nao existe e `room "${roomId}" is locked` quando `maxClients` ja
 * foi atingido (a Room trava sozinha ao encher). Best-effort deliberado
 * (Design Notes do spec): se a mensagem nao bater com nenhum dos dois
 * padroes conhecidos, cai numa mensagem generica cobrindo ambos os casos
 * em vez de travar ou mostrar um erro tecnico pro convidado.
 */
function mensagemDeErro(erro: unknown): MensagemErro {
  const texto = erro instanceof Error ? erro.message : String(erro);

  if (/not found/i.test(texto)) {
    return MENSAGEM_SALA_INEXISTENTE;
  }

  if (/locked/i.test(texto)) {
    return MENSAGEM_SALA_CHEIA;
  }

  return MENSAGEM_GENERICA;
}
