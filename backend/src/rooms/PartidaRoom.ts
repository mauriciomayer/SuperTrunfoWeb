import { Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import { EstadoPartida } from "../schema/EstadoPartida.ts";
import { Jogador } from "../schema/Jogador.ts";
import type { Carta } from "../schema/Carta.ts";
import { carregarBaralho, distribuir, embaralhar } from "../game/baralho.ts";

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
    // Explicito mesmo sendo o default da classe (Story 2.1, AD-5) -- deixa
    // claro, no proprio ponto de criacao da Room, que este e o estado
    // inicial da maquina de estados do game loop.
    this.state.estado = "AguardandoJogadores";

    for (let indice = 1; indice <= totalIA; indice++) {
      const jogadorIA = new Jogador();
      jogadorIA.nome = `IA ${indice}`;
      jogadorIA.isIA = true;
      this.state.jogadores.push(jogadorIA);
    }

    this.onMessage("iniciarPartida", (client) => this.aoReceberIniciarPartida(client));

    console.log(
      `[PartidaRoom] sala criada: ${this.roomId} (totalJogadores=${totalJogadores}, totalIA=${totalIA})`,
    );
  }

  /**
   * Handler de `iniciarPartida` (Story 2.1, AD-1/AD-3/AD-5/AD-6): primeiro
   * handler real da `PartidaRoom` pra esse intent (o frontend ja manda
   * desde a Story 1.4, mas nao havia handler nenhum ate aqui).
   *
   * Validacao (servidor e a autoridade, AD-1) -- tres checagens, cada uma
   * rejeitando silenciosamente (so loga em nivel `warn` -- sao races
   * esperadas do cliente, ex: clique duplo ou botao desatualizado, nao
   * erros de verdade -- e retorna sem mutar `state`): so aceita do
   * Jogador com `isHost: true`; so em `estado === "AguardandoJogadores"`;
   * e so com pelo menos `MIN_JOGADORES` na sala (o frontend ja desabilita
   * o botao "Iniciar" antes disso, mas o servidor nunca confia so na UI).
   * Sem lancar erro pro cliente -- nao ha UI esperando uma resposta de
   * erro aqui (o botao some depois do primeiro clique, ver
   * `SalaDeEspera.tsx`).
   *
   * Distribuicao: baralho de 32 Cartas (`carregarBaralho`), embaralhado
   * (`embaralhar`) e distribuido (`distribuir`, regra de sobra AD-6) na
   * mesma ordem de `state.jogadores` (humanos + IA, ja misturados na
   * ordem que `onCreate`/`onJoin` construiram). Essa cadeia e a unica
   * parte do handler que pode lancar (ex: CSV ausente/corrompido) --
   * embrulhada em try/catch, loga em nivel `error` (isso sim e uma falha
   * de verdade, nao uma race de cliente) e retorna sem mutar `state`.
   * Cada Jogador recebe seu Monte (FIFO, indice 0 = topo) e tem
   * `quantidadeCartas` atualizada (contagem publica, Boundaries).
   *
   * Anti-cheat real (AD-3): concede visibilidade via `StateView` so da
   * propria Carta do topo (indice 0), e so pro `Client` dono daquele
   * Jogador -- nunca o Monte inteiro, nem pro proprio dono. Vagas de IA
   * nao tem `Client` de rede (`this.clients` so lista humanos conectados),
   * entao ninguem recebe visibilidade do Monte delas -- coerente, ja que
   * ninguem deveria mesmo (Boundaries: "IA so recebe Monte como qualquer
   * outro Jogador").
   *
   * Jogador Inicial = sempre o host (AD-5, confirmado, sem sorteio).
   *
   * `this.lock()` ao final (sucesso): sem isso, a Room continuaria
   * aceitando `joinById` enquanto `maxClients` (baseado em
   * `totalJogadores`, nao no minimo de 2 que habilita o botao) nao fosse
   * atingido -- um convidado entrando depois da distribuicao ficaria com
   * Monte vazio, sem Carta nem `StateView`, travado pra sempre.
   */
  private async aoReceberIniciarPartida(client: Client): Promise<void> {
    const remetente = this.state.jogadores.find(
      (jogador) => jogador.sessionId === client.sessionId,
    );

    if (!remetente?.isHost) {
      console.warn(
        `[PartidaRoom] iniciarPartida rejeitado: ${client.sessionId} nao e o host (AD-1)`,
      );
      return;
    }

    if (this.state.estado !== "AguardandoJogadores") {
      console.warn(
        `[PartidaRoom] iniciarPartida rejeitado: estado atual e "${this.state.estado}", esperado "AguardandoJogadores"`,
      );
      return;
    }

    if (this.state.jogadores.length < MIN_JOGADORES) {
      console.warn(
        `[PartidaRoom] iniciarPartida rejeitado: so ${this.state.jogadores.length} jogador(es) na sala, minimo e ${MIN_JOGADORES} (AD-1)`,
      );
      return;
    }

    let baralhoEmbaralhado: Carta[];
    let montes: Carta[][];
    try {
      baralhoEmbaralhado = embaralhar(carregarBaralho());
      montes = distribuir(baralhoEmbaralhado, this.state.jogadores.length);
    } catch (erroBaralho) {
      console.error(
        `[PartidaRoom] iniciarPartida falhou ao montar o Baralho (sala ${this.roomId}):`,
        erroBaralho,
      );
      return;
    }

    this.state.jogadores.forEach((jogador, indice) => {
      jogador.monte.push(...montes[indice]);
      jogador.quantidadeCartas = jogador.monte.length;
    });

    this.clients.forEach((clienteConectado) => {
      const jogadorDoCliente = this.state.jogadores.find(
        (jogador) => jogador.sessionId === clienteConectado.sessionId,
      );
      if (jogadorDoCliente && jogadorDoCliente.monte.length > 0) {
        clienteConectado.view = clienteConectado.view ?? new StateView();
        clienteConectado.view.add(jogadorDoCliente.monte[0]);
      }
    });

    const host = this.state.jogadores.find((jogador) => jogador.isHost);
    this.state.jogadorDaVez = host?.sessionId ?? "";
    this.state.estado = "AguardandoSelecao";

    await this.lock();

    const totalDistribuido = montes.reduce((soma, monte) => soma + monte.length, 0);
    const descartadas = baralhoEmbaralhado.length - totalDistribuido;
    console.log(
      `[PartidaRoom] partida iniciada: ${this.roomId} (${this.state.jogadores.length} jogadores, ${montes[0]?.length ?? 0} cartas cada, ${descartadas} descartadas)`,
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
