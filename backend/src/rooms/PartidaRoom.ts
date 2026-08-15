import { Room, type Client } from "colyseus";
import { EstadoPartida } from "../schema/EstadoPartida.ts";
import { Jogador } from "../schema/Jogador.ts";

const MIN_JOGADORES = 2;
const MAX_JOGADORES = 4;

interface OpcoesCriarSala {
  totalJogadores?: number;
  totalIA?: number;
}

interface OpcoesEntrar {
  nome?: string;
}

/**
 * Valida `totalJogadores`/`totalIA` no servidor -- AD-1: o servidor e a
 * autoridade, nunca confia so na validacao do formulario do frontend.
 * Lanca erro (o que faz `client.create()` rejeitar a promise no frontend,
 * ver Matrix "totalIA invalido") se os valores nao forem inteiros dentro
 * da faixa esperada.
 */
export function validarOpcoesCriarSala(options: OpcoesCriarSala): {
  totalJogadores: number;
  totalIA: number;
} {
  const totalJogadores = options?.totalJogadores;
  const totalIA = options?.totalIA;

  if (
    typeof totalJogadores !== "number" ||
    !Number.isInteger(totalJogadores) ||
    totalJogadores < MIN_JOGADORES ||
    totalJogadores > MAX_JOGADORES
  ) {
    throw new Error(
      `totalJogadores invalido: precisa ser um inteiro entre ${MIN_JOGADORES} e ${MAX_JOGADORES} (recebido: ${String(totalJogadores)})`,
    );
  }

  if (
    typeof totalIA !== "number" ||
    !Number.isInteger(totalIA) ||
    totalIA < 0 ||
    totalIA > totalJogadores - 1
  ) {
    throw new Error(
      `totalIA invalido: precisa ser um inteiro entre 0 e ${totalJogadores - 1}, sempre sobrando ao menos 1 vaga humana pro host (recebido: ${String(totalIA)})`,
    );
  }

  return { totalJogadores, totalIA };
}

/**
 * PartidaRoom -- cobre o ciclo de vida inteiro de uma Partida (AD-2), da
 * Sala de Espera ao Fim de Partida. Nesta historia (1.2) so cuida da
 * criacao: valida os totais declarados pelo host, monta o estado inicial
 * (`EstadoPartida`) com as vagas de IA ja preenchidas (FR-5) e marca o
 * primeiro Jogador humano a entrar como host.
 *
 * `onCreate` roda inteiro antes do auto-join do host disparar `onJoin` --
 * por isso os Jogadores de IA (empurrados aqui) ja existem no array
 * quando a logica de "primeiro humano = host" roda em `onJoin` (Colyseus
 * processa isso sequencialmente no mesmo ciclo de criacao, sem corrida).
 */
export class PartidaRoom extends Room<{ state: EstadoPartida }> {
  onCreate(options: OpcoesCriarSala) {
    const { totalJogadores, totalIA } = validarOpcoesCriarSala(options);

    // So vagas humanas contam pra conexao de rede -- as de IA nunca conectam.
    this.maxClients = totalJogadores - totalIA;

    this.setState(new EstadoPartida());
    this.state.totalJogadoresDeclarado = totalJogadores;
    this.state.totalIADeclarado = totalIA;

    for (let indice = 1; indice <= totalIA; indice++) {
      const jogadorIA = new Jogador();
      jogadorIA.nome = `IA ${indice}`;
      jogadorIA.isIA = true;
      this.state.jogadores.push(jogadorIA);
    }

    console.log(
      `[PartidaRoom] sala criada: ${this.roomId} (totalJogadores=${totalJogadores}, totalIA=${totalIA})`,
    );
  }

  onJoin(client: Client, options?: OpcoesEntrar) {
    const nome = options?.nome?.trim();
    if (!nome) {
      // AD-1: o servidor e a autoridade -- a UI ja bloqueia nome vazio, mas
      // o servidor nao pode confiar so nisso (alguem pode contornar a UI).
      throw new Error("nome invalido: obrigatorio pra entrar na sala, nao pode ser vazio");
    }

    const jogador = new Jogador();
    jogador.sessionId = client.sessionId;
    jogador.nome = nome;
    // O primeiro Jogador humano a entrar e sempre o host (decisao ja fechada).
    jogador.isHost = !this.state.jogadores.some((existente) => !existente.isIA);
    this.state.jogadores.push(jogador);

    console.log(`[PartidaRoom] cliente entrou: ${client.sessionId} (${jogador.nome})`);
  }

  /**
   * Story 1.4: remove o `Jogador` correspondente de `state.jogadores` --
   * como a Partida ainda nao comecou nesta fase (Sala de Espera), nao ha
   * Monte nem estado de jogo pra preservar, a pessoa so some da lista. O
   * `room.state` reativo (Story 1.2/1.3) propaga a remocao pro frontend
   * sem trabalho extra (ver Design Notes do spec). Sem distincao entre
   * saida limpa e desconexao abrupta (`consented`) -- fora de escopo (ver
   * Boundaries), e sem reatribuir host se quem sai for o proprio host.
   */
  onLeave(client: Client) {
    const indice = this.state.jogadores.findIndex(
      (jogador) => jogador.sessionId === client.sessionId,
    );
    if (indice !== -1) {
      this.state.jogadores.splice(indice, 1);
    }

    console.log(`[PartidaRoom] cliente saiu: ${client.sessionId}`);
  }

  onDispose() {
    console.log(`[PartidaRoom] sala destruida: ${this.roomId}`);
  }
}
