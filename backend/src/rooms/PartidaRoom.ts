import { Room, type Client } from "colyseus";
import { ArraySchema, StateView } from "@colyseus/schema";
import { EstadoPartida } from "../schema/EstadoPartida.ts";
import { Jogador } from "../schema/Jogador.ts";
import { Carta } from "../schema/Carta.ts";
import { carregarBaralho, distribuir, embaralhar } from "../game/baralho.ts";
import { ATRIBUTOS, atributoValido } from "../game/atributos.ts";
import { determinarVencedor, type CandidatoComparacao } from "../game/comparacao.ts";
import { determinarVencedorSuperTrunfo, type CandidatoSuperTrunfo } from "../game/superTrunfo.ts";
import { proximoJogadorAtivo } from "../game/turno.ts";
import type { TipoVitoria } from "../schema/ResultadoRodada.ts";

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

/**
 * Pausa fixa (Story 2.3, Design Notes do spec) entre a transicao pra
 * "Revelando" e a resolucao de fato da Rodada -- tempo real pra revelacao
 * chegar em rede antes do resultado. Sem essa pausa cruzando pelo menos um
 * ciclo de rede, "Revelando" nunca chegaria a existir de verdade num patch
 * (concessao e revogacao de `StateView` no mesmo tick se cancelam antes de
 * qualquer coisa ser transmitida). Nao conflita com o teto de 1,5s de
 * *processamento* (NFR-1) -- a pausa e' UX deliberada, a comparacao em si
 * roda em microssegundos dentro do callback do timer.
 */
export const DURACAO_REVELACAO_MS = 2500;

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
   * Handler de `jogarCarta` (Story 2.2/2.4, AD-1/AD-3/AD-5/AD-7): so aceita
   * a Carta do topo do Jogador da vez, em `AguardandoSelecao` -- qualquer
   * outra origem e rejeitada silenciosamente (log em nivel `warn`, `return`
   * sem mutar `state`), mesma filosofia de `aoReceberIniciarPartida`.
   *
   * Duas checagens iniciais em sequencia, cada uma um `return` isolado
   * (Matrix da Story 2.2): (1) `client.sessionId` precisa bater com
   * `rodadaAtual.jogadorDaVez`; (2) `estado` precisa ser
   * `"AguardandoSelecao"`.
   *
   * A partir dai, o servidor decide o que a Carta do topo desencadeia
   * olhando so a flag `superTrunfo` dela (Technical Decisions do epico:
   * "um unico intent cobre os dois casos"), nunca o cliente: se
   * `superTrunfo === true`, `atributo` e ignorado por completo (Story 2.4,
   * AD-1) -- mesmo se vier preenchido -- e `rodadaAtual.superTrunfoJogadoPor`
   * e setado no lugar de `atributoSelecionado` (mutuamente exclusivos).
   * Senao, `atributo` continua obrigatorio e validado contra `ATRIBUTOS`
   * (Story 2.2, sem mudanca de comportamento) antes de preencher
   * `atributoSelecionado`.
   *
   * Ao aceitar (os dois casos): preenche `rodadaAtual.cartasEmDisputa` com
   * a Carta do topo de cada Jogador ativo -- "ativo" (Story 2.6) =
   * `monte.length > 0`, um Jogador eliminado nunca entra em disputa nem
   * recebe revelacao. Concede `StateView` dessas mesmas Cartas pra **todo**
   * `Client` conectado (nao
   * so o dono de cada uma -- mesmo `client.view.add()` da Story
   * 2.1/`aoReceberIniciarPartida`, chamado agora pra cada combinacao
   * cliente x Jogador ativo, e' assim que a revelacao simultanea/concessao
   * do Super Trunfo funciona) e transiciona `estado` pra `"Revelando"`
   * (fluxo normal) ou `"SuperTrunfoAcionado"` (Story 2.4 -- nunca
   * `"Revelando"` pra essa Carta, Boundaries "Always": sem revelacao de
   * Atributo). Nada aqui revoga a visibilidade concedida anteriormente
   * (dono continua vendo a propria Carta do topo) -- so soma mais
   * concessoes.
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

    // Story 2.4: a flag da propria Carta do topo do remetente decide o
    // ramo -- nunca o cliente (Technical Decisions do epico). `atributo`
    // so e obrigatorio/validado quando a Carta NAO e a Super Trunfo.
    const ehSuperTrunfo = remetente.monte[0]?.superTrunfo === true;

    let atributo: string | undefined;
    if (!ehSuperTrunfo) {
      atributo = mensagem?.atributo;
      if (!atributoValido(atributo)) {
        console.warn(
          `[PartidaRoom] jogarCarta rejeitado: atributo invalido/ausente (recebido: ${String(atributo)}) (AD-7)`,
        );
        return;
      }
    }

    // "Ativo" (Story 2.6, Boundaries "Always") = `monte.length > 0` -- um
    // Jogador eliminado (Monte zerado) some da revelacao/turno, mas
    // continua em `state.jogadores` (conectado, vendo a Partida, assento
    // marcado "Eliminado" no frontend).
    const jogadoresAtivos = this.state.jogadores.filter((jogador) => jogador.monte.length > 0);

    if (ehSuperTrunfo) {
      this.state.rodadaAtual.superTrunfoJogadoPor = remetente.sessionId;
      this.state.rodadaAtual.atributoSelecionado = "";
    } else {
      this.state.rodadaAtual.atributoSelecionado = atributo!;
      this.state.rodadaAtual.superTrunfoJogadoPor = "";
    }
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

    // Story 2.4: Super Trunfo pula reto pra "SuperTrunfoAcionado" -- nunca
    // "Revelando" (Boundaries "Always": sem revelacao de Atributo pra essa
    // Carta).
    this.state.estado = ehSuperTrunfo ? "SuperTrunfoAcionado" : "Revelando";

    // Story 2.3 (reaproveitada pelo Super Trunfo, Story 2.4): agenda a
    // resolucao pra depois da mesma pausa de revelacao (ver
    // `DURACAO_REVELACAO_MS`) -- nunca resolve na mesma execucao sincrona
    // que concedeu a revelacao/concessao (Design Notes do spec: sem isso, o
    // Colyseus nunca emitiria um patch de rede intermediario mostrando o
    // estado intermediario).
    this.clock.setTimeout(() => this.resolverRodada(), DURACAO_REVELACAO_MS);

    console.log(
      ehSuperTrunfo
        ? `[PartidaRoom] jogarCarta aceito: ${client.sessionId} jogou a Super Trunfo (sala ${this.roomId})`
        : `[PartidaRoom] jogarCarta aceito: ${client.sessionId} selecionou "${atributo}" (sala ${this.roomId})`,
    );
  }

  /**
   * resolverRodada (Story 2.3, branch de Super Trunfo Story 2.4) -- roda
   * dentro do callback do `this.clock.setTimeout` agendado ao final de
   * `aoReceberJogarCarta`. Opera direto em `state.jogadores`/
   * `jogador.monte[0]` pra tudo (Never: `rodadaAtual.cartasEmDisputa` e so
   * o retrato de schema do AD-5, sem associacao confiavel de dono se algum
   * Jogador tiver ficado sem Carta no meio do caminho -- Design Notes do
   * spec).
   *
   * "Ativo" (Story 2.6, Boundaries "Always") = `monte.length > 0`. Apos
   * CADA branch (empate e sem-empate, ja com as Cartas movidas/coletadas),
   * computa `ativos = state.jogadores.filter(monte.length > 0)`: 1 restante
   * encerra a Partida via `encerrarPartida()` (absorvendo o Funil retido se
   * houver -- mesmo `push` do caminho vencedor, nunca duplicado -- ANTES de
   * chamar `encerrarPartida()`, que so cuida do `estado`/limpeza de
   * `rodadaAtual` em si, identica nos dois branches pra nao dessincronizar
   * um do outro); 2+ segue o fluxo normal. No branch de empate, se isso
   * acabou de eliminar o proprio `jogadorDaVez`, a vez avança -- circular,
   * ordem de entrada (`game/turno.ts`, `proximoJogadorAtivo`) -- pro
   * proximo Jogador ativo. O caso degenerado `ativos.length === 0` (empate
   * elimina TODOS os Jogadores que jogaram, ninguem sobra em toda a
   * Partida) e checado ANTES de mover qualquer Carta (mesmo padrao
   * defensivo do "vencedor desconectou" abaixo): loga `warn`, nao muda
   * `estado`/Cartas.
   *
   * Achado da implementacao (branch sem-empate): `ativos.length === 1`
   * SOZINHO nao basta pra declarar Fim de Partida -- tambem exige
   * `jogadoresQueJogaram.length >= 2` (Boundaries "Never": desconexao/
   * takeover e territorio do Epico 3). Sem esse guard, um oponente que
   * DESCONECTA (sai de `state.jogadores` de vez, `onLeave`) durante a
   * pausa de "Revelando" faz `jogadoresQueJogaram` cair pra 1 so pelo
   * tamanho da sala ter encolhido -- nao porque alguem de fato perdeu
   * todas as Cartas -- e declarar vitoria nesse caso seria confundir
   * "adversario saiu da sala" com "adversario foi eliminado" (a mesma
   * distincao que o "vencedor desconectou" ja protege duas linhas abaixo).
   *
   * `rodadaAtual.superTrunfoJogadoPor` (Story 2.4) decide QUAL funcao pura
   * escolhe o vencedor primeiro (Design Notes do spec: "o branch de Super
   * Trunfo so troca qual funcao pura decide o vencedor, reaproveitando
   * 100% do resto"): se preenchido, `determinarVencedorSuperTrunfo`
   * (`game/superTrunfo.ts`) contra o indice do Jogador do Super Trunfo
   * dentro de `jogadoresQueJogaram`; senao, o `determinarVencedor` de
   * sempre (`game/comparacao.ts`) contra `atributoSelecionado`. Nunca
   * empate no branch de Super Trunfo (Boundaries "Never") -- so o fluxo
   * normal de Atributo pode cair em "Funil".
   *
   * Sem empate: o vencedor recebe TODAS as Cartas jogadas na Rodada (a
   * propria incluida) no fundo do proprio Monte -- removidas (nunca
   * clonadas, `Array.shift`/`.push` movem a instancia real) do topo de
   * cada Jogador que jogou. `rodadaAtual.jogadorDaVez` vira o vencedor;
   * `atributoSelecionado`/`superTrunfoJogadoPor`/`cartasEmDisputa` sao
   * limpos; `estado` volta pra "AguardandoSelecao". `StateView`: revoga
   * (todo Client) a visibilidade das Cartas reveladas nesta Rodada, concede
   * de novo (so o dono, mesmo padrao de `aoReceberIniciarPartida`) o NOVO
   * topo de cada Jogador ativo que ainda tiver Carta. `ultimoResultado`
   * (incluindo `tipoVitoria`, Story 2.4) e preenchido pro Chip de Resultado
   * do frontend (UX-DR7). Story 2.5: se `funil.quantidadeCartasPresas > 0`
   * (Funil com Cartas retidas de empate(s) anterior(es) da MESMA sequencia
   * de desempate), o vencedor leva tudo -- Cartas da Rodada, dos
   * adversarios, E as do Funil -- no mesmo `push`; o Funil esvazia (nova
   * `ArraySchema`, `quantidadeCartasPresas = 0`).
   *
   * Com empate (2+ Jogadores no valor vencedor, so no fluxo normal de
   * Atributo, Story 2.5): as Cartas da Rodada saem do topo de cada
   * `jogadorQueJogou` e vao pro Funil (reatribuindo `monte`/
   * `funil.cartasPresas` a instancias NOVAS de `ArraySchema`, mesma cautela
   * de `parentIndex` do caminho vencedor); `ultimoResultado` e limpo
   * (`vencedorNome`/`atributo` vazios -- sem isso o Chip de Resultado
   * mostraria a ultima vitoria de verdade como se fosse desta Rodada);
   * `rodadaAtual.jogadorDaVez` NAO muda (quem abriu a Rodada empatada
   * escolhe de novo); `atributoSelecionado`/`cartasEmDisputa` sao limpos
   * (mesma Rodada logica, mas nova selecao); `estado` volta DIRETO pra
   * "AguardandoSelecao" -- nunca fica parado em "Funil" (Design Notes do
   * spec: sem StateView novo que dependa de um ciclo de rede pra aparecer,
   * entao a transicao inteira e sincrona, sem pausa). `StateView`: mesmo
   * padrao do caminho vencedor -- revoga (todo Client) a visibilidade das
   * Cartas que saem pro Funil, concede de novo (so o dono) o NOVO topo de
   * cada Jogador ativo.
   */
  /**
   * encerrarPartida (Story 2.6) -- bookkeeping COMUM aos dois caminhos que
   * podem terminar a Partida dentro de `resolverRodada` (empate/"vitoria
   * por atrito" e sem-empate/"vitoria por coleta"): so chamado DEPOIS que
   * o vencedor ja absorveu tudo (propria Rodada + Funil, cada caminho com
   * seu proprio jeito de fazer isso -- este metodo nao mexe em Carta
   * nenhuma). Extraido pra evitar o tipo de dessincronia entre os dois
   * branches que a revisao de codigo encontrou aqui: o caminho "vitoria
   * por coleta" deixava `rodadaAtual.atributoSelecionado`/
   * `superTrunfoJogadoPor`/`cartasEmDisputa` da ULTIMA Rodada jogada
   * grudados no estado publico pra sempre (nunca limpos, ao contrario do
   * bookkeeping normal de fim de Rodada logo abaixo); o caminho "vitoria
   * por atrito" simetricamente nunca rodava o skip de vez, podendo deixar
   * `jogadorDaVez` apontando pro proprio Jogador que acabou de ser
   * eliminado pelo empate que terminou a Partida.
   *
   * `jogadorDaVez` e limpo (`""`) em vez de preservado -- nenhuma UI le
   * `rodadaAtual` depois que `estado` vira "FimDePartida" (`App.tsx` roteia
   * pra `FimDePartida.tsx`, nunca mais `MesaDeJogo.tsx`), entao nao ha um
   * valor "certo" a manter; zerar deixa o dado publico coerente com o fato
   * de que a Rodada/vez perderam o sentido, em vez de sobrar lixo de uma
   * Rodada que nunca mais vai ser retomada.
   */
  private encerrarPartida(): void {
    this.state.estado = "FimDePartida";
    this.state.rodadaAtual.jogadorDaVez = "";
    this.state.rodadaAtual.atributoSelecionado = "";
    this.state.rodadaAtual.superTrunfoJogadoPor = "";
    this.state.rodadaAtual.cartasEmDisputa.splice(0, this.state.rodadaAtual.cartasEmDisputa.length);
  }

  private resolverRodada(): void {
    const superTrunfoJogadoPor = this.state.rodadaAtual.superTrunfoJogadoPor;
    const ehSuperTrunfo = superTrunfoJogadoPor !== "";
    const atributoSelecionado = this.state.rodadaAtual.atributoSelecionado;

    const jogadoresQueJogaram = this.state.jogadores.filter((jogador) => jogador.monte[0]);

    let vencedorSessionId: string;
    let tipoVitoria: TipoVitoria;

    if (ehSuperTrunfo) {
      const indiceDoSuperTrunfo = jogadoresQueJogaram.findIndex(
        (jogador) => jogador.sessionId === superTrunfoJogadoPor,
      );
      if (indiceDoSuperTrunfo === -1) {
        // Mesmo achado defensivo do fluxo normal (ver abaixo): o proprio
        // Jogador do Super Trunfo pode ter desconectado durante a pausa de
        // "SuperTrunfoAcionado" -- sem indice valido, nao ha ordem circular
        // pra percorrer. Aborta antes de mover qualquer Carta.
        console.warn(
          `[PartidaRoom] resolverRodada: Jogador do Super Trunfo ${superTrunfoJogadoPor} nao esta mais em state.jogadores (desconectou durante SuperTrunfoAcionado, sala ${this.roomId}) -- abortando resolucao, nenhuma Carta movida`,
        );
        return;
      }

      const candidatosSuperTrunfo: CandidatoSuperTrunfo[] = jogadoresQueJogaram.map((jogador) => ({
        sessionId: jogador.sessionId,
        carta: jogador.monte[0],
      }));

      const resultadoSuperTrunfo = determinarVencedorSuperTrunfo(
        candidatosSuperTrunfo,
        indiceDoSuperTrunfo,
      );
      vencedorSessionId = resultadoSuperTrunfo.vencedorSessionId;
      tipoVitoria = resultadoSuperTrunfo.anuladoPorCartaA ? "cartaA" : "superTrunfo";
    } else {
      const configAtributo = ATRIBUTOS.find((atributo) => atributo.chave === atributoSelecionado);

      const candidatos: CandidatoComparacao[] = jogadoresQueJogaram.map((jogador) => ({
        sessionId: jogador.sessionId,
        carta: jogador.monte[0],
      }));

      const resultado = determinarVencedor(
        candidatos,
        atributoSelecionado,
        configAtributo?.inverso ?? false,
      );

      if (resultado.empate) {
        // Story 2.6 (Boundaries "Never"): caso totalmente degenerado --
        // este empate eliminaria TODOS os Jogadores que jogaram, e nenhum
        // outro Jogador na Partida continua ativo (2+ eliminados no MESMO
        // empate, ninguem sobra). Simula o resultado ANTES de mover
        // qualquer Carta (mesmo padrao defensivo do "vencedor desconectou
        // durante a pausa" mais abaixo): quem jogou nesta Rodada perde
        // exatamente 1 Carta (a que foi pro Funil), quem nao jogou fica
        // como esta. Se ninguem sobrar ativo, loga `warn` e aborta --
        // `estado`/Cartas ficam exatamente como estavam, sem crash. Resolver
        // esse empate/vitoria-nenhuma de verdade e decisao de design de jogo
        // futura, nao desta historia (ver deferred-work.md).
        const sessionIdsQueJogaram = new Set(
          jogadoresQueJogaram.map((jogador) => jogador.sessionId),
        );
        const ativosAposEmpateSimulado = this.state.jogadores.filter((jogador) => {
          const monteRestante = sessionIdsQueJogaram.has(jogador.sessionId)
            ? jogador.monte.length - 1
            : jogador.monte.length;
          return monteRestante > 0;
        });

        if (ativosAposEmpateSimulado.length === 0) {
          console.warn(
            `[PartidaRoom] resolverRodada: empate em "${atributoSelecionado}" eliminaria TODOS os Jogadores da Partida (sala ${this.roomId}) -- caso degenerado (Boundaries "Never"), abortando resolucao, nenhuma Carta movida`,
          );
          return;
        }

        // Story 2.5: revoga StateView das Cartas da Rodada -- mesmo loop do
        // caminho vencedor (abaixo), ANTES de mover qualquer Carta (precisa
        // da referencia AINDA no topo de `jogador.monte[0]` pra revogar a
        // concessao certa).
        this.clients.forEach((clienteConectado) => {
          jogadoresQueJogaram.forEach((jogador) => {
            clienteConectado.view?.remove(jogador.monte[0]);
          });
        });

        // Move a Carta do topo de cada Jogador que jogou pro Funil --
        // mesma cautela de `ArraySchema.parentIndex` do caminho vencedor
        // (reatribui `monte` a uma instancia NOVA, nunca `shift()`/
        // `splice()` na mesma instancia).
        const cartasParaFunil: Carta[] = jogadoresQueJogaram.map((jogador) => {
          const cartaRemovida = jogador.monte[0];
          const restante = jogador.monte.slice(1);
          jogador.monte = new ArraySchema<Carta>(...restante);
          jogador.quantidadeCartas = jogador.monte.length;
          return cartaRemovida as Carta;
        });

        // Acumula no Funil -- tambem reatribuindo a uma instancia NOVA
        // (mesma cautela), pra sobreviver a empates consecutivos da mesma
        // sequencia de desempate (Matrix "Empates consecutivos").
        this.state.funil.cartasPresas = new ArraySchema<Carta>(
          ...this.state.funil.cartasPresas,
          ...cartasParaFunil,
        );
        this.state.funil.quantidadeCartasPresas = this.state.funil.cartasPresas.length;

        // Limpa `ultimoResultado` -- sem isso o Chip de Resultado mostraria
        // a ultima vitoria de verdade como se fosse desta Rodada
        // (Boundaries "Always").
        this.state.ultimoResultado.vencedorNome = "";
        this.state.ultimoResultado.atributo = "";

        // Mesma Rodada logica, nova selecao (Approach/Design Notes do
        // spec): `jogadorDaVez` NAO muda -- quem abriu a Rodada empatada
        // escolhe de novo, com a Carta que sobrou no topo.
        // `atributoSelecionado`/`cartasEmDisputa` sao limpos pra nao vazar
        // a selecao/revelacao anterior (ja movida pro Funil) pra dentro da
        // nova selecao. `estado` volta DIRETO pra "AguardandoSelecao" --
        // nunca fica parado em "Funil" em rede (Design Notes: sem StateView
        // novo dependendo de um ciclo de rede aqui, a transicao inteira e
        // sincrona).
        this.state.rodadaAtual.atributoSelecionado = "";
        this.state.rodadaAtual.superTrunfoJogadoPor = "";
        this.state.rodadaAtual.cartasEmDisputa.splice(
          0,
          this.state.rodadaAtual.cartasEmDisputa.length,
        );
        this.state.estado = "AguardandoSelecao";

        // Concede de novo StateView do NOVO topo de cada Jogador ativo pro
        // proprio dono -- mesmo loop pos-vitoria.
        this.clients.forEach((clienteConectado) => {
          const jogadorDoCliente = this.state.jogadores.find(
            (jogador) => jogador.sessionId === clienteConectado.sessionId,
          );
          if (jogadorDoCliente && jogadorDoCliente.monte.length > 0) {
            clienteConectado.view = clienteConectado.view ?? new StateView();
            clienteConectado.view.add(jogadorDoCliente.monte[0]);
          }
        });

        // Story 2.6: computa quantos Jogadores continuam ativos DEPOIS deste
        // empate -- o caso `=== 0` ja foi descartado acima (simulado ANTES
        // de mover Carta nenhuma), entao aqui so restam 1 ou 2+.
        const ativosAposEmpate = this.state.jogadores.filter(
          (jogador) => jogador.monte.length > 0,
        );

        if (ativosAposEmpate.length === 1) {
          // Fim de Partida por atrito (Boundaries "Always"): este empate
          // eliminou todos os outros Jogadores de uma vez -- o unico
          // sobrevivente absorve o Funil (que acabou de ser preenchido
          // acima com as Cartas desta Rodada empatada, mais qualquer coisa
          // retida de empates anteriores da mesma sequencia) -- mesmo
          // `push` do caminho vencedor (Story 2.5), nunca duplicado.
          // `encerrarPartida()` cuida do resto (`estado`/limpeza de
          // `rodadaAtual`, incluindo `jogadorDaVez` -- sem isso ficaria
          // preservado apontando pro proprio Jogador que este empate
          // acabou de eliminar, achado da revisao de codigo).
          const vencedorFinal = ativosAposEmpate[0];
          if (this.state.funil.quantidadeCartasPresas > 0) {
            vencedorFinal.monte.push(...this.state.funil.cartasPresas);
            vencedorFinal.quantidadeCartas = vencedorFinal.monte.length;
            this.state.funil.cartasPresas = new ArraySchema<Carta>();
            this.state.funil.quantidadeCartasPresas = 0;
          }
          this.encerrarPartida();
          console.log(
            `[PartidaRoom] resolverRodada: Fim de Partida (vitoria por atrito) -- empate em "${atributoSelecionado}" eliminou todos os demais, ${vencedorFinal.nome} absorveu o Funil e reuniu ${vencedorFinal.quantidadeCartas} Carta(s) (sala ${this.roomId})`,
          );
          return;
        }

        // Story 2.6: se o empate acabou de eliminar o proprio
        // `jogadorDaVez` (a Carta empatada era a ultima dele), avanca a vez
        // -- circular, ordem de entrada -- pro proximo Jogador ativo (nunca
        // fica travada num Jogador eliminado). So chega aqui com
        // `ativosAposEmpate.length >= 2` (os casos 0/1 ja retornaram acima).
        // Se `jogadorDaVezAtual` nem existir mais (desconectou durante a
        // pausa -- gap ja documentado em deferred-work.md, Story 2.5), nao
        // mexe em nada aqui, fora do escopo desta historia.
        const jogadorDaVezAtual = this.state.jogadores.find(
          (jogador) => jogador.sessionId === this.state.rodadaAtual.jogadorDaVez,
        );
        if (jogadorDaVezAtual && jogadorDaVezAtual.monte.length === 0) {
          this.state.rodadaAtual.jogadorDaVez = proximoJogadorAtivo(
            this.state.jogadores,
            this.state.rodadaAtual.jogadorDaVez,
          );
        }

        console.log(
          `[PartidaRoom] resolverRodada: empate em "${atributoSelecionado}" (sala ${this.roomId}) -- ${cartasParaFunil.length} Carta(s) presa(s) no Funil (total ${this.state.funil.quantidadeCartasPresas}), jogadorDaVez = ${this.state.rodadaAtual.jogadorDaVez}, estado volta pra AguardandoSelecao`,
        );
        return;
      }

      vencedorSessionId = resultado.vencedorSessionId;
      tipoVitoria = "atributo";
    }

    // Acha o vencedor ANTES de mover qualquer Carta (achado da revisao do
    // diff): um Jogador -- principalmente o vencedor -- pode ter se
    // desconectado durante os 2,5s de "Revelando"/"SuperTrunfoAcionado"
    // (`onLeave` ja o removeu de `state.jogadores` antes deste callback
    // disparar). Se isso acontecer, aborta a resolucao inteira ANTES de
    // qualquer `shift()`: nenhuma Carta se move, `estado`/`jogadorDaVez`/
    // `cartasEmDisputa` ficam exatamente como estavam -- a Rodada
    // simplesmente nao resolve desta vez (o comportamento "certo" de jogo
    // pra esse caso e decisao do Epico 3, ver deferred-work.md). Sem essa
    // checagem ANTES da remocao, as Cartas coletadas de todo mundo
    // sumiriam do estado (removidas do Monte de quem jogou, nunca
    // empurradas em lugar nenhum) e `jogadorDaVez` ficaria apontando pra
    // uma sessao inexistente, travando a Partida pra sempre.
    const vencedor = this.state.jogadores.find(
      (jogador) => jogador.sessionId === vencedorSessionId,
    );
    if (!vencedor) {
      console.warn(
        `[PartidaRoom] resolverRodada: vencedor ${vencedorSessionId} nao esta mais em state.jogadores (desconectou durante Revelando/SuperTrunfoAcionado, sala ${this.roomId}) -- abortando resolucao, nenhuma Carta movida`,
      );
      return;
    }

    this.clients.forEach((clienteConectado) => {
      jogadoresQueJogaram.forEach((jogador) => {
        clienteConectado.view?.remove(jogador.monte[0]);
      });
    });

    // Remove a Carta jogada reatribuindo `monte` a uma instancia NOVA de
    // `ArraySchema` (em vez de `jogador.monte.shift()`/`.splice()` na MESMA
    // instancia) -- achado empirico da revisao do diff, reproduzido
    // isolado numa 2a Rodada consecutiva na mesma sala: `shift()`/`splice()`
    // no `@colyseus/schema` (^4.0.30) NAO atualizam o `parentIndex` interno
    // dos elementos que sobram no array quando um item anterior e removido
    // (so a propria lista de operacoes pendentes do array e reindexada, o
    // `changeTree` de cada Carta continua achando que esta na posicao
    // antiga) -- ao conceder `StateView` de novo pra essa Carta numa
    // Rodada seguinte, o `parentIndex` desatualizado faz o Client receber
    // um objeto vazio (sem nenhum campo) em vez dos dados reais. Uma
    // instancia NOVA de `ArraySchema` forca cada Carta a ser re-anexada
    // (`setParent`) do zero, com o `parentIndex` correto.
    const cartasColetadas: Carta[] = jogadoresQueJogaram.map((jogador) => {
      const cartaRemovida = jogador.monte[0];
      const restante = jogador.monte.slice(1);
      jogador.monte = new ArraySchema<Carta>(...restante);
      jogador.quantidadeCartas = jogador.monte.length;
      return cartaRemovida as Carta;
    });

    vencedor.monte.push(...cartasColetadas);
    vencedor.quantidadeCartas = vencedor.monte.length;

    // Story 2.5: se o Funil tem Cartas retidas de empate(s) anterior(es)
    // desta mesma sequencia de desempate, o vencedor leva tudo junto com a
    // Rodada em si -- mesmo padrao de `push` das Cartas da propria Rodada
    // (linha acima, `cartasPresas` nunca precisa da cautela de
    // `parentIndex` aqui porque so estamos ADICIONANDO ao Monte do
    // vencedor, nunca removendo de um array compartilhado). Funil esvazia
    // (nova `ArraySchema`, `quantidadeCartasPresas = 0`) -- nunca fica
    // preso de uma sequencia de desempate pra outra.
    if (this.state.funil.quantidadeCartasPresas > 0) {
      vencedor.monte.push(...this.state.funil.cartasPresas);
      vencedor.quantidadeCartas = vencedor.monte.length;
      this.state.funil.cartasPresas = new ArraySchema<Carta>();
      this.state.funil.quantidadeCartasPresas = 0;
    }

    this.state.ultimoResultado.vencedorNome = vencedor.nome;
    // Story 2.4: so o fluxo normal de Atributo preenche esse campo -- nas
    // duas variantes de Super Trunfo nao houve comparacao de Atributo
    // nenhuma (Boundaries "Always": tipoVitoria "superTrunfo"/"cartaA").
    this.state.ultimoResultado.atributo = ehSuperTrunfo ? "" : atributoSelecionado;
    this.state.ultimoResultado.tipoVitoria = tipoVitoria;

    // Story 2.6: computa quantos Jogadores continuam ativos DEPOIS de
    // coletar/absorver tudo -- o vencedor sempre fica ativo (recebeu no
    // minimo a propria Carta de volta), entao esse filtro nunca fica vazio
    // aqui (so o branch de empate, acima, tem o caso degenerado de 0).
    //
    // `jogadoresQueJogaram.length >= 2` (Boundaries "Never": desconexao/
    // takeover e territorio do Epico 3, ja delimitado nas historias
    // anteriores): sem esse guard, um Jogador que DESCONECTA (sai de
    // `state.jogadores` de vez, Story 1.4 `onLeave`) durante a pausa de
    // "Revelando" faria `jogadoresQueJogaram` cair pra 1 so pelo tamanho da
    // sala ter encolhido -- nao porque alguem de fato perdeu todas as
    // Cartas -- e essa funcao declararia Fim de Partida por um motivo
    // errado (o mesmo achado defensivo da Story 2.3, "vencedor
    // desconectou", agora tambem precisa proteger a transicao pra
    // FimDePartida). Numa Rodada legitima (sem essa corrida), so chegar
    // aqui com `estado === "AguardandoSelecao"` ja implica >= 2 Jogadores
    // ativos no inicio da Rodada -- entao esse guard nunca barra um Fim de
    // Partida genuino, so essa corrida especifica de desconexao.
    const ativos = this.state.jogadores.filter((jogador) => jogador.monte.length > 0);

    if (ativos.length === 1 && jogadoresQueJogaram.length >= 2) {
      // Fim de Partida por coleta (Boundaries "Always"): o Funil (se havia)
      // ja foi absorvido acima, junto com a propria Rodada -- so falta
      // encerrar a Partida via `encerrarPartida()`, sem o resto do
      // bookkeeping de proxima Rodada logo abaixo (StateView da proxima
      // selecao nao faz mais sentido, nao ha proxima Rodada) --
      // `encerrarPartida()` ja cuida de limpar `rodadaAtual` (achado da
      // revisao de codigo: antes deste metodo compartilhado, este branch
      // especificamente deixava `atributoSelecionado`/`superTrunfoJogadoPor`/
      // `cartasEmDisputa` da ultima Rodada jogada grudados no estado
      // publico pra sempre).
      this.encerrarPartida();
      console.log(
        `[PartidaRoom] resolverRodada: Fim de Partida (vitoria por coleta) -- ${vencedor.nome} reuniu ${vencedor.quantidadeCartas} Carta(s) (sala ${this.roomId})`,
      );
      return;
    }

    this.state.rodadaAtual.jogadorDaVez = vencedorSessionId;
    this.state.rodadaAtual.atributoSelecionado = "";
    this.state.rodadaAtual.superTrunfoJogadoPor = "";
    this.state.rodadaAtual.cartasEmDisputa.splice(0, this.state.rodadaAtual.cartasEmDisputa.length);
    this.state.estado = "AguardandoSelecao";

    this.clients.forEach((clienteConectado) => {
      const jogadorDoCliente = this.state.jogadores.find(
        (jogador) => jogador.sessionId === clienteConectado.sessionId,
      );
      if (jogadorDoCliente && jogadorDoCliente.monte.length > 0) {
        clienteConectado.view = clienteConectado.view ?? new StateView();
        clienteConectado.view.add(jogadorDoCliente.monte[0]);
      }
    });

    console.log(
      ehSuperTrunfo
        ? `[PartidaRoom] resolverRodada: vencedor ${vencedorSessionId} via Super Trunfo (tipoVitoria=${tipoVitoria}, sala ${this.roomId}), estado volta pra AguardandoSelecao`
        : `[PartidaRoom] resolverRodada: vencedor ${vencedorSessionId} em "${atributoSelecionado}" (sala ${this.roomId}), estado volta pra AguardandoSelecao`,
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
