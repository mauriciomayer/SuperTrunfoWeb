import { Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import { EstadoPartida } from "../schema/EstadoPartida.ts";
import { Jogador } from "../schema/Jogador.ts";
import { Carta } from "../schema/Carta.ts";
import { carregarBaralho, distribuir, embaralhar } from "../game/baralho.ts";
import { atributoValido } from "../game/atributos.ts";

/**
 * Clona os campos de uma Carta pra uma instancia nova de `Schema`
 * (`@colyseus/schema`) -- cada instancia so pode pertencer a UM campo
 * Schema por vez; reusar a mesma instancia de `Jogador.monte[0]` dentro de
 * `rodadaAtual.cartasEmDisputa` corrompe a arvore de encoding (o
 * StateView de outros Clients para de propagar a Carta original -- achado
 * empirico, coberto pela Matrix de `PartidaRoom.integration.test.ts`
 * "selecao valida"). `cartasEmDisputa` guarda uma copia de valores, nunca
 * a mesma instancia -- a visibilidade de `monte[0]` continua concedida
 * via `client.view.add()` na instancia original.
 */
export function clonarCarta(original: Carta): Carta {
  const copia = new Carta();
  copia.id = original.id;
  copia.grupo = original.grupo;
  copia.letra = original.letra;
  copia.pais = original.pais;
  copia.superTrunfo = original.superTrunfo;
  copia.velocidadeMaxima = original.velocidadeMaxima;
  copia.potenciaCv = original.potenciaCv;
  copia.potenciaHp = original.potenciaHp;
  copia.rpmMaximo = original.rpmMaximo;
  copia.cilindrada = original.cilindrada;
  copia.aceleracao = original.aceleracao;
  copia.qtdCilindros = original.qtdCilindros;
  return copia;
}

const MIN_JOGADORES = 2;
const MAX_JOGADORES = 4;

interface OpcoesCriarSala {
  totalJogadores?: number;
  totalIA?: number;
}

interface OpcoesEntrar {
  nome?: string;
}

interface OpcoesJogarCarta {
  atributo?: string;
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
    this.onMessage("jogarCarta", (client, mensagem: OpcoesJogarCarta) =>
      this.aoReceberJogarCarta(client, mensagem),
    );

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
    this.state.rodadaAtual.jogadorDaVez = host?.sessionId ?? "";
    this.state.estado = "AguardandoSelecao";

    await this.lock();

    const totalDistribuido = montes.reduce((soma, monte) => soma + monte.length, 0);
    const descartadas = baralhoEmbaralhado.length - totalDistribuido;
    console.log(
      `[PartidaRoom] partida iniciada: ${this.roomId} (${this.state.jogadores.length} jogadores, ${montes[0]?.length ?? 0} cartas cada, ${descartadas} descartadas)`,
    );
  }

  /**
   * Handler de `jogarCarta` (Story 2.2, AD-1/AD-3/AD-5/AD-7): so aceita a
   * selecao de Atributo do Jogador da vez, em `AguardandoSelecao`, com um
   * `atributo` valido (`atributos.ts`) -- qualquer outra origem e
   * rejeitada silenciosamente (log em nivel `warn`, `return` sem mutar
   * `state`), mesma filosofia de `aoReceberIniciarPartida`.
   *
   * Tres checagens em sequencia, cada uma um `return` isolado (Matrix da
   * Story 2.2): (1) `client.sessionId` precisa bater com
   * `rodadaAtual.jogadorDaVez`; (2) `estado` precisa ser
   * `"AguardandoSelecao"`; (3) `atributo` precisa ser uma `chave` valida
   * de `ATRIBUTOS` (cobre invalido e ausente/undefined, ja que Super
   * Trunfo -- que tornaria `atributo` opcional -- e Story 2.4, fora de
   * escopo aqui).
   *
   * Ao aceitar: preenche `rodadaAtual.atributoSelecionado` e
   * `rodadaAtual.cartasEmDisputa` com a Carta do topo de cada Jogador
   * ativo -- nesta Story, "ativo" = todo `state.jogadores`, ninguem foi
   * eliminado ainda (Story 2.6). Concede `StateView` dessas mesmas Cartas
   * pra **todo** `Client` conectado (nao so o dono de cada uma -- mesmo
   * `client.view.add()` da Story 2.1/`aoReceberIniciarPartida`, chamado
   * agora pra cada combinacao cliente x Jogador ativo, e' assim que a
   * revelacao simultanea funciona) e transiciona `estado` pra
   * `"Revelando"`. Nada aqui revoga a visibilidade concedida
   * anteriormente (dono continua vendo a propria Carta do topo) -- so
   * soma mais concessoes.
   */
  private aoReceberJogarCarta(client: Client, mensagem?: OpcoesJogarCarta): void {
    const remetente = this.state.jogadores.find(
      (jogador) => jogador.sessionId === client.sessionId,
    );

    if (!remetente || remetente.sessionId !== this.state.rodadaAtual.jogadorDaVez) {
      console.warn(
        `[PartidaRoom] jogarCarta rejeitado: ${client.sessionId} nao e o Jogador da vez (AD-1)`,
      );
      return;
    }

    if (this.state.estado !== "AguardandoSelecao") {
      console.warn(
        `[PartidaRoom] jogarCarta rejeitado: estado atual e "${this.state.estado}", esperado "AguardandoSelecao"`,
      );
      return;
    }

    const atributo = mensagem?.atributo;
    if (!atributoValido(atributo)) {
      console.warn(
        `[PartidaRoom] jogarCarta rejeitado: atributo invalido/ausente (recebido: ${String(atributo)}) (AD-7)`,
      );
      return;
    }

    // "Ativo" nesta Story (2.2) = todo `state.jogadores` -- ninguem foi
    // eliminado ainda, isso e Story 2.6 (Boundaries).
    const jogadoresAtivos = this.state.jogadores;

    this.state.rodadaAtual.atributoSelecionado = atributo;
    this.state.rodadaAtual.cartasEmDisputa.splice(
      0,
      this.state.rodadaAtual.cartasEmDisputa.length,
    );

    jogadoresAtivos.forEach((jogador) => {
      const cartaTopo = jogador.monte[0];
      if (!cartaTopo) {
        // Nao deveria acontecer nesta Story (2.2): "ativo" ainda e todo
        // `state.jogadores`, ninguem foi eliminado (Monte zerado e Story
        // 2.6). Loga pra nao passar em silencio se algum dia acontecer.
        console.warn(
          `[PartidaRoom] jogarCarta: Jogador ${jogador.sessionId || jogador.nome} sem Carta no topo do Monte, pulado em cartasEmDisputa`,
        );
        return;
      }
      this.state.rodadaAtual.cartasEmDisputa.push(clonarCarta(cartaTopo));
    });

    this.clients.forEach((clienteConectado) => {
      clienteConectado.view = clienteConectado.view ?? new StateView();
      // Capturado numa const local: a closure do `forEach` aninhado abaixo
      // faz o TypeScript perder a narrowing de `clienteConectado.view`
      // (possivelmente `undefined`) feita na linha de cima.
      const viewDoCliente = clienteConectado.view;
      jogadoresAtivos.forEach((jogador) => {
        const cartaTopo = jogador.monte[0];
        if (!cartaTopo) {
          console.warn(
            `[PartidaRoom] jogarCarta: Jogador ${jogador.sessionId || jogador.nome} sem Carta no topo do Monte, StateView nao concedido pra ${clienteConectado.sessionId}`,
          );
          return;
        }
        viewDoCliente.add(cartaTopo);
      });
    });

    this.state.estado = "Revelando";

    console.log(
      `[PartidaRoom] jogarCarta aceito: ${client.sessionId} selecionou "${atributo}" (sala ${this.roomId})`,
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
