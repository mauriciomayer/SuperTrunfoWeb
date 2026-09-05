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
import { decidirAtributoIA } from "../game/ia.ts";
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
  copia.imagem = original.imagem;
  copia.modelo = original.modelo;
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

/**
 * Pausa fixa (Story 6.1, revisao de AD-4) entre a transicao que torna um
 * assento de IA o Jogador da vez e o despacho de fato da jogada automatica
 * dela -- mesmo valor/padrao de `DURACAO_REVELACAO_MS` acima. AD-4 original
 * proibia qualquer atraso server-side aqui ("ritmo visual e so client-side"),
 * mas isso era estruturalmente impossivel: sem nenhum `await`/yield entre a
 * transicao pra `AguardandoSelecao` com `jogadorDaVez` = IA e a aplicacao da
 * jogada, o cliente nunca chegava a observar o estado intermediario "e a vez
 * da IA, ela ainda nao jogou" -- so o resultado ja aplicado, tornando
 * qualquer atraso client-side impossivel de atrasar contra um estado que
 * nunca existiu em rede. Ver `agendarJogadaDeIA` abaixo.
 */
export const PAUSA_IA_MS = 2500;

/**
 * Janela de tolerancia (Story 7.1) pra uma desconexao ABRUPTA (nao
 * consentida, `onDrop`) na Sala de Espera (`estado === "AguardandoJogadores"`)
 * antes do assento ser removido de `state.jogadores` -- valor baseado no
 * incidente real investigado via log do Render (2 de setembro): o host
 * levou ~28s entre criar a sala e a propria conexao cair (troca de app pra
 * compartilhar o link do convite, provavel suspensao do WebSocket pelo
 * celular em segundo plano). So se aplica em `AguardandoJogadores` -- uma
 * Partida ja em andamento continua com o comportamento da Story 3.2 (assento
 * vira IA permanentemente, sem nenhuma janela), ver `onDrop` abaixo.
 */
export const JANELA_RECONEXAO_SALA_DE_ESPERA_S = 30;

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
  /**
   * Rastreia (Story 7.1, achado da revisao) quais `sessionId` estao
   * atualmente no meio da janela de reconexao (entre `onDrop` chamar
   * `allowReconnection` e essa `Deferred` resolver ou expirar) -- usado
   * pelo guard novo de `aoReceberIniciarPartida` abaixo, pra nunca deixar a
   * Partida comecar com um assento "fantasma" (nem reconectado, nem ainda
   * convertido pra IA/removido). Populado/limpo inteiramente dentro de
   * `onDrop` (ver comentario la pro mecanismo completo) -- nunca lido nem
   * escrito em nenhum outro lugar.
   */
  private readonly sessoesReconectando = new Set<string>();

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
      // Story 3.1: `sessionId` sintetico e unico por assento (`ia-N`),
      // nunca deixado no default `""` -- ver doc de `Jogador.sessionId`
      // pro porque (2+ vagas de IA compartilhando o mesmo `sessionId`
      // colidia com o sentinela de "nenhuma Super Trunfo jogada" e com
      // qualquer lookup por `sessionId` em `resolverRodada`).
      jogadorIA.sessionId = `ia-${indice}`;
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
   * Validacao (servidor e a autoridade, AD-1) -- quatro checagens, cada uma
   * rejeitando silenciosamente (so loga em nivel `warn` -- sao races
   * esperadas do cliente, ex: clique duplo ou botao desatualizado, nao
   * erros de verdade -- e retorna sem mutar `state`): so aceita do
   * Jogador com `isHost: true`; so em `estado === "AguardandoJogadores"`;
   * so com pelo menos `MIN_JOGADORES` na sala (o frontend ja desabilita
   * o botao "Iniciar" antes disso, mas o servidor nunca confia so na UI);
   * e (Story 7.1, achado da revisao) so com `sessoesReconectando` vazio --
   * nenhum assento pode estar no meio da janela de reconexao (`onDrop`
   * chamado, ainda nao resolveu nem expirou), senao a Partida podia comecar
   * com um assento "fantasma" e travar a Rodada pra sempre se a vez dele
   * chegasse antes da janela terminar. Sem lancar erro pro cliente -- nao
   * ha UI esperando uma resposta de erro aqui (o botao some depois do
   * primeiro clique, ver `SalaDeEspera.tsx`).
   *
   * Preenchimento de vaga (Story 3.1, Approach): depois das quatro checagens
   * acima e ANTES de embaralhar/distribuir, qualquer vaga humana ainda nao
   * preenchida (`state.jogadores.length < totalJogadoresDeclarado`) vira IA
   * automaticamente -- `sessionId` sintetico unico (`ia-N`, ver doc de
   * `Jogador.sessionId`), numeracao continuada a partir de
   * `totalIADeclarado`, que e atualizado pra refletir o total real.
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

    if (this.sessoesReconectando.size > 0) {
      console.warn(
        `[PartidaRoom] iniciarPartida rejeitado: ${this.sessoesReconectando.size} assento(s) no meio da janela de reconexao (sala ${this.roomId})`,
      );
      return;
    }

    // Story 3.1 (Approach/Boundaries "Always"): qualquer vaga humana ainda
    // nao preenchida quando o host inicia -- alem da IA ja declarada em
    // `onCreate` -- vira IA automaticamente, ANTES de embaralhar/distribuir
    // (pra ela receber Monte igual a qualquer outro assento). Continua a
    // numeracao "IA N" a partir de `totalIADeclarado + 1` -- nunca colide
    // com o nome de uma IA ja declarada na criacao da sala.
    const vagasFaltantes = this.state.totalJogadoresDeclarado - this.state.jogadores.length;
    if (vagasFaltantes > 0) {
      const totalIAAntes = this.state.totalIADeclarado;
      for (let indice = 1; indice <= vagasFaltantes; indice++) {
        const jogadorIA = new Jogador();
        jogadorIA.nome = `IA ${totalIAAntes + indice}`;
        jogadorIA.isIA = true;
        // Story 3.1: mesmo `sessionId` sintetico unico (`ia-N`) do loop de
        // `onCreate` -- numeracao continuada a partir de `totalIAAntes`,
        // nunca colide com uma IA ja declarada na criacao da sala.
        jogadorIA.sessionId = `ia-${totalIAAntes + indice}`;
        this.state.jogadores.push(jogadorIA);
      }
      this.state.totalIADeclarado = totalIAAntes + vagasFaltantes;
      console.log(
        `[PartidaRoom] iniciarPartida: ${vagasFaltantes} vaga(s) humana(s) nao preenchida(s) virou(aram) IA (sala ${this.roomId}, totalIADeclarado agora ${this.state.totalIADeclarado})`,
      );
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
   * Story 3.1: essas duas checagens sao a UNICA responsabilidade que sobra
   * aqui -- so fazem sentido pra uma mensagem de rede de verdade (um
   * `Client` humano nunca deveria conseguir mandar `jogarCarta` fora da
   * propria vez/fora de `AguardandoSelecao`). Toda a mutacao de fato
   * (decisao Super Trunfo vs Atributo, `cartasEmDisputa`, `StateView`,
   * transicao de `estado`, agendamento da pausa de revelacao) foi extraida
   * pra `processarJogada` -- reaproveitada tambem pela jogada automatica de
   * IA (`resolverRodada`), que nunca passa por este handler (nao tem
   * `Client`/`sessionId` de rede pra validar).
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

    this.processarJogada(remetente, mensagem);
  }

  /**
   * processarJogada (Story 3.1, extraida de `aoReceberJogarCarta` --
   * Boundaries "Always": "a jogada da IA passa pela MESMA logica de
   * mutacao que jogarCarta de um humano usaria"): tudo que
   * `aoReceberJogarCarta` fazia DEPOIS das checagens de
   * `sessionId`/vez/`estado` -- este metodo nao repete/conhece nenhuma
   * dessas checagens, e nao sabe (nem precisa saber) se `remetente` e IA
   * ou humano. `aoReceberJogarCarta` (mensagem real de rede, so humano)
   * valida e delega pra ca; `despacharJogadaDeIA` (Story 3.1, chamada de
   * dentro do callback agendado por `agendarJogadaDeIA`, Story 6.1) chama
   * ISTO DIRETO com o `Jogador` de IA ja resolvido -- nenhum `await`/yield
   * DENTRO deste metodo, condicao pra nenhuma outra mensagem conseguir
   * intercalar enquanto ele roda (Design Notes do spec, AD-4). A Story 6.1
   * revisou SO o momento em que `despacharJogadaDeIA`/este metodo sao
   * chamados pra uma IA (agora depois de `PAUSA_IA_MS`, nao mais na mesma
   * execucao que setou `estado = "AguardandoSelecao"`) -- a atomicidade
   * INTERNA deste metodo continua igual.
   *
   * Doc original de `aoReceberJogarCarta` (Story 2.2/2.4, AD-1/AD-3/AD-5/
   * AD-7), agora descrevendo este metodo: a partir das checagens ja feitas
   * pelo chamador, o servidor decide o que a Carta do topo desencadeia
   * olhando so a flag `superTrunfo` dela (Technical Decisions do epico:
   * "um unico intent cobre os dois casos"), nunca o cliente/chamador: se
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
   * `Client` conectado (nao so o dono de cada uma -- mesmo `client.view.add()`
   * da Story 2.1/`aoReceberIniciarPartida`, chamado agora pra cada
   * combinacao cliente x Jogador ativo, e' assim que a revelacao
   * simultanea/concessao do Super Trunfo funciona) e transiciona `estado`
   * pra `"Revelando"` (fluxo normal) ou `"SuperTrunfoAcionado"` (Story 2.4
   * -- nunca `"Revelando"` pra essa Carta, Boundaries "Always": sem
   * revelacao de Atributo). Nada aqui revoga a visibilidade concedida
   * anteriormente (dono continua vendo a propria Carta do topo) -- so soma
   * mais concessoes.
   *
   * A validacao de `atributo` ausente/invalido (`return` sem mutar `state`)
   * so pode disparar de verdade pro caminho humano -- `resolverRodada`
   * (Story 3.1) so chama este metodo com um `atributo` ja resolvido
   * (`decidirAtributoIA`, sempre uma das 7 chaves validas) ou `undefined`
   * exatamente quando a Carta da IA e a Super Trunfo (branch que nem olha
   * `atributo`), entao esse `return` defensivo nunca deveria disparar pro
   * caminho de IA -- mas continua aqui do mesmo jeito, sem bifurcar a
   * logica por tipo de remetente.
   */
  private processarJogada(remetente: Jogador, mensagem?: OpcoesJogarCarta): void {
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

    // Story 7.3 (FR-38): calcula o vencedor da Rodada AGORA, no mesmo
    // instante sincrono em que a revelacao e concedida -- nao espera a
    // pausa de `DURACAO_REVELACAO_MS` acabar. `jogadoresAtivos` e o mesmo
    // dado que acabou de popular `cartasEmDisputa` acima, passado direto
    // sem recomputar. Ver doc de `calcularResultadoImediato`.
    this.calcularResultadoImediato(jogadoresAtivos);

    // Story 2.3 (reaproveitada pelo Super Trunfo, Story 2.4): agenda a
    // resolucao pra depois da mesma pausa de revelacao (ver
    // `DURACAO_REVELACAO_MS`) -- nunca resolve na mesma execucao sincrona
    // que concedeu a revelacao/concessao (Design Notes do spec: sem isso, o
    // Colyseus nunca emitiria um patch de rede intermediario mostrando o
    // estado intermediario).
    this.clock.setTimeout(() => this.resolverRodada(), DURACAO_REVELACAO_MS);

    // `remetente.sessionId || remetente.nome` (Story 3.1): identifica quem
    // jogou tanto pra um humano (sessionId real) quanto pra uma IA
    // (sessionId sempre "", cai no nome -- mesmo padrao ja usado nos logs
    // de `cartasEmDisputa` acima).
    console.log(
      ehSuperTrunfo
        ? `[PartidaRoom] jogarCarta aceito: ${remetente.sessionId || remetente.nome} jogou a Super Trunfo (sala ${this.roomId})`
        : `[PartidaRoom] jogarCarta aceito: ${remetente.sessionId || remetente.nome} selecionou "${atributo}" (sala ${this.roomId})`,
    );
  }

  /**
   * calcularResultadoImediato (Story 7.3, FR-38) -- chamado SINCRONAMENTE
   * de dentro de `processarJogada`, logo depois de `estado` virar
   * "Revelando"/"SuperTrunfoAcionado" e ANTES do `this.clock.setTimeout`
   * que agenda `resolverRodada`. Preenche `state.ultimoResultado` no MESMO
   * instante em que a revelacao e concedida -- o Chip de Resultado do
   * frontend (`MesaDeJogo.tsx`) nao precisa mais esperar a pausa de
   * `DURACAO_REVELACAO_MS` acabar pra mostrar quem ganhou.
   *
   * Metodo NOVO e SEPARADO de `resolverRodada` -- nunca uma extracao de
   * logica compartilhada entre os dois (Boundaries/Design Notes do spec:
   * os dois tem necessidades de guard genuinamente diferentes).
   * `resolverRodada` continua 100% intocado, incluindo suas proprias
   * atribuicoes (agora redundantes, mas inofensivas) de `ultimoResultado`.
   *
   * So preenche (vitoria) ou limpa (empate) `ultimoResultado` -- NUNCA move
   * Carta, troca `jogadorDaVez`, mexe no Funil, nem decide Fim de Partida.
   * Tudo isso continua em `resolverRodada`, depois da pausa, exatamente
   * como hoje.
   *
   * `jogadoresAtivos` (recebido do chamador, mesmo dado que populou
   * `cartasEmDisputa`) e o equivalente, neste instante sincrono, ao
   * `jogadoresQueJogaram` de `resolverRodada` -- ninguem pode ter
   * desconectado ou perdido Carta entre um e outro (nenhum `jogarCarta`
   * novo e aceito durante `Revelando`/`SuperTrunfoAcionado`).
   *
   * NAO replica os guards defensivos de `resolverRodada` contra um Jogador
   * ter desconectado durante a pausa (indice do Super Trunfo nao
   * encontrado, vencedor nao encontrado) -- esses guards existem pra um
   * cenario estruturalmente inalcancavel desde a Story 3.2 (`onLeave` numa
   * Partida em andamento nunca mais remove um Jogador), e aqui, chamado
   * ANTES da pausa comecar, o remetente e todo `jogadoresAtivos` estao
   * garantidamente presentes em `state.jogadores` -- os guards nunca
   * poderiam disparar.
   */
  private calcularResultadoImediato(jogadoresAtivos: Jogador[]): void {
    const superTrunfoJogadoPor = this.state.rodadaAtual.superTrunfoJogadoPor;
    const ehSuperTrunfo = superTrunfoJogadoPor !== "";
    const atributoSelecionado = this.state.rodadaAtual.atributoSelecionado;

    let vencedorSessionId: string;
    let tipoVitoria: TipoVitoria;

    if (ehSuperTrunfo) {
      const indiceDoSuperTrunfo = jogadoresAtivos.findIndex(
        (jogador) => jogador.sessionId === superTrunfoJogadoPor,
      );

      const candidatosSuperTrunfo: CandidatoSuperTrunfo[] = jogadoresAtivos.map((jogador) => ({
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

      const candidatos: CandidatoComparacao[] = jogadoresAtivos.map((jogador) => ({
        sessionId: jogador.sessionId,
        carta: jogador.monte[0],
      }));

      const resultado = determinarVencedor(
        candidatos,
        atributoSelecionado,
        configAtributo?.inverso ?? false,
      );

      if (resultado.empate) {
        // Boundaries/Matrix "Empate": limpa `ultimoResultado` imediatamente
        // -- o Chip de Resultado nunca aparece pra uma Rodada empatada
        // (mesma intencao do bookkeeping de empate em `resolverRodada`,
        // so que aqui de imediato).
        this.state.ultimoResultado.vencedorNome = "";
        this.state.ultimoResultado.atributo = "";
        return;
      }

      vencedorSessionId = resultado.vencedorSessionId;
      tipoVitoria = "atributo";
    }

    // Sem o guard de "vencedor nao encontrado" (ver doc do metodo acima) --
    // `vencedorSessionId` sempre corresponde a um dos `jogadoresAtivos`
    // recebidos neste instante sincrono.
    const vencedor = jogadoresAtivos.find((jogador) => jogador.sessionId === vencedorSessionId)!;

    this.state.ultimoResultado.vencedorNome = vencedor.nome;
    // Story 2.4: so o fluxo normal de Atributo preenche esse campo -- nas
    // duas variantes de Super Trunfo nao houve comparacao de Atributo
    // nenhuma (Boundaries "Always": tipoVitoria "superTrunfo"/"cartaA").
    this.state.ultimoResultado.atributo = ehSuperTrunfo ? "" : atributoSelecionado;
    this.state.ultimoResultado.tipoVitoria = tipoVitoria;
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
        // Mesmo achado defensivo do fluxo normal (ver abaixo) -- guard
        // preservado por seguranca, mas estruturalmente inalcancavel via
        // desconexao a partir da Story 3.2: antes dela, o proprio Jogador
        // do Super Trunfo podia desconectar durante a pausa de
        // "SuperTrunfoAcionado" e sumir de `state.jogadores` (`onLeave`
        // removia incondicionalmente), deixando sem indice valido pra
        // percorrer a ordem circular. Agora `onLeave` numa Partida em
        // andamento nunca mais remove -- vira `isIA = true` no lugar --
        // entao `jogadoresQueJogaram` sempre encontra esse Jogador (mesma
        // logica ja documentada no branch normal de Atributo, doc de
        // `vencedor` abaixo). Aborta antes de mover qualquer Carta, caso
        // algum caminho futuro ainda consiga deixar `indiceDoSuperTrunfo`
        // invalido.
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
        // `jogadorDaVezAtual` nao encontrado (gap original documentado em
        // deferred-work.md, Story 2.5: o abridor da Rodada empatada
        // desconecta durante a pausa) e RESOLVIDO pela Story 3.2 --
        // `onLeave` numa Partida em andamento nunca mais remove o Jogador
        // de `state.jogadores` (vira `isIA = true` no lugar), entao esse
        // `find` sempre encontra uma sessao valida agora.
        const jogadorDaVezAtual = this.state.jogadores.find(
          (jogador) => jogador.sessionId === this.state.rodadaAtual.jogadorDaVez,
        );
        // `jogadorDaVezFinal` (Story 3.1): resolve o `Jogador` que abre a
        // proxima selecao pro objeto de verdade, SEM um novo lookup por
        // `sessionId` no caso comum -- reaproveita `jogadorDaVezAtual` (ja
        // resolvido acima) quando a vez NAO avancou; so faz um lookup novo
        // (inevitavel, `proximoJogadorAtivo` so devolve `sessionId`) quando
        // ela avancou. Vagas de IA compartilham `sessionId === ""` (achado
        // ja documentado em deferred-work.md) -- por isso o objeto e
        // reaproveitado sempre que possivel, em vez de sempre relookup.
        let jogadorDaVezFinal: Jogador | undefined;
        if (jogadorDaVezAtual && jogadorDaVezAtual.monte.length === 0) {
          this.state.rodadaAtual.jogadorDaVez = proximoJogadorAtivo(
            this.state.jogadores,
            this.state.rodadaAtual.jogadorDaVez,
          );
          jogadorDaVezFinal = this.state.jogadores.find(
            (jogador) => jogador.sessionId === this.state.rodadaAtual.jogadorDaVez,
          );
        } else {
          jogadorDaVezFinal = jogadorDaVezAtual;
        }

        console.log(
          `[PartidaRoom] resolverRodada: empate em "${atributoSelecionado}" (sala ${this.roomId}) -- ${cartasParaFunil.length} Carta(s) presa(s) no Funil (total ${this.state.funil.quantidadeCartasPresas}), jogadorDaVez = ${this.state.rodadaAtual.jogadorDaVez}, estado volta pra AguardandoSelecao`,
        );

        // Story 3.1 (Approach/AD-4), revisada pela Story 6.1: se o Jogador
        // que abre a proxima selecao e controlado por IA, a jogada dela e
        // AGENDADA (nao mais despachada na mesma execucao sincrona) --
        // `estado` ja reflete `AguardandoSelecao` com `jogadorDaVez` = IA
        // aqui, e `agendarJogadaDeIA` so aplica a jogada de fato apos
        // `PAUSA_IA_MS` (ver doc do metodo).
        if (jogadorDaVezFinal?.isIA) {
          this.agendarJogadaDeIA(jogadorDaVezFinal);
        }
        return;
      }

      vencedorSessionId = resultado.vencedorSessionId;
      tipoVitoria = "atributo";
    }

    // Acha o vencedor ANTES de mover qualquer Carta (achado original da
    // revisao do diff, Story 2.3) -- guard preservado por seguranca, mas
    // estruturalmente inalcancavel via desconexao a partir da Story 3.2:
    // antes dela, um Jogador -- principalmente o vencedor -- podia se
    // desconectar durante os 2,5s de "Revelando"/"SuperTrunfoAcionado" e
    // `onLeave` ja o removia de `state.jogadores` antes deste callback
    // disparar, deixando `vencedor` sem correspondencia. Agora `onLeave`
    // numa Partida em andamento nunca mais remove -- vira `isIA = true` no
    // lugar, preservando Monte/sessionId -- entao este `find` sempre
    // encontra o vencedor de verdade (mesmo que a sessao real dele ja
    // tenha caido), e credita a vitoria normalmente. Aborta antes de mover
    // qualquer Carta caso algum caminho futuro ainda consiga deixar
    // `vencedor` sem correspondencia: nenhuma Carta se move, `estado`/
    // `jogadorDaVez`/`cartasEmDisputa` ficam exatamente como estavam (ver
    // deferred-work.md pro historico deste achado e da resolucao pela
    // Story 3.2).
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

    // Story 3.1 (Approach/AD-4), revisada pela Story 6.1: o vencedor vira
    // `jogadorDaVez` -- se ele e controlado por IA, a jogada dela e AGENDADA
    // (nao mais despachada na mesma execucao sincrona) via
    // `agendarJogadaDeIA` (ver doc do metodo pra PAUSA_IA_MS). Usa o objeto
    // `vencedor` ja resolvido logo acima -- nunca um novo lookup por
    // `sessionId` (vagas de IA compartilham `sessionId === ""`, achado ja
    // documentado em deferred-work.md).
    if (vencedor.isIA) {
      this.agendarJogadaDeIA(vencedor);
    }
  }

  /**
   * agendarJogadaDeIA (Story 6.1, revisao de AD-4) -- ponto unico pelo qual
   * os 3 chamadores de `despacharJogadaDeIA` (branch vencedor e branch de
   * empate de `resolverRodada`, mais `onLeave` quando a desconexao acontece
   * na propria vez da IA) agendam a jogada automatica, em vez de despachar
   * na mesma execucao sincrona que torna o assento o Jogador da vez. Mesmo
   * padrao de timer ja usado pra pausa de revelacao (`this.clock.setTimeout`,
   * `DURACAO_REVELACAO_MS`) -- amarrado ao ciclo de vida da propria Room,
   * sem guardar referencia nem logica de cancelamento manual (Design Notes
   * do spec).
   *
   * Durante a pausa, `estado` ja reflete `AguardandoSelecao` com
   * `jogadorDaVez` apontando pro assento IA (o chamador ja fez essa
   * transicao ANTES de chamar este metodo) -- o cliente ja pode mostrar
   * "Aguardando {nome} escolher..." (mensagem generica que ja existe em
   * `MesaDeJogo.tsx` pra qualquer Jogador que nao seja "eu", sem mudanca de
   * frontend). Nenhuma outra mensagem e processada durante a janela de
   * espera (AD-5): o timer agendado e a unica coisa pendente, mesma
   * atomicidade que a chamada sincrona anterior garantia, so que agora
   * adiada.
   */
  private agendarJogadaDeIA(jogadorIA: Jogador): void {
    this.clock.setTimeout(() => this.despacharJogadaDeIA(jogadorIA), PAUSA_IA_MS);
  }

  /**
   * despacharJogadaDeIA (Story 3.1) -- decide e aplica a jogada automatica
   * de um Jogador de IA cujo `resolverRodada` acabou de resolver como o
   * proximo a selecionar (`jogadorDaVez` novo, sem empate; ou preservado/
   * avancado, com empate). So chamada DIRETO com o objeto `Jogador` ja
   * resolvido pelo chamador -- nunca faz o proprio lookup por `sessionId`
   * (mesma razao documentada nos dois pontos de chamada em
   * `resolverRodada`). A partir da Story 6.1, o chamador de verdade e
   * sempre o callback de `agendarJogadaDeIA` (acima) -- nunca mais chamada
   * direto de `resolverRodada`/`onLeave`.
   *
   * `decidirAtributoIA` (`game/ia.ts`) so e chamada quando a Carta do topo
   * da IA NAO e a Super Trunfo -- reaproveita o mesmo branch `ehSuperTrunfo`
   * que `processarJogada` ja usa pra um humano, nunca duplicado aqui
   * (Boundaries "Always" do spec). `processarJogada` (extraida de
   * `aoReceberJogarCarta`) e chamada em seguida, ainda dentro do mesmo
   * callback sincrono -- garante a atomicidade de AD-4 (nenhuma outra
   * mensagem processada no meio-tempo).
   */
  private despacharJogadaDeIA(jogadorIA: Jogador): void {
    const cartaTopo = jogadorIA.monte[0];
    if (!cartaTopo) {
      // Defensivo: nao deveria acontecer (os dois chamadores em
      // `resolverRodada` so passam pra ca um Jogador que acabaram de
      // confirmar como ativo, `monte.length > 0`) -- protege contra um
      // futuro caminho de chamada que viole essa premissa em vez de deixar
      // `decidirAtributoIA` receber `undefined`.
      console.warn(
        `[PartidaRoom] despacharJogadaDeIA: IA ${jogadorIA.nome} sem Carta no topo do Monte, jogada automatica pulada (sala ${this.roomId})`,
      );
      return;
    }

    const ehSuperTrunfo = cartaTopo.superTrunfo === true;
    const atributo = ehSuperTrunfo ? undefined : decidirAtributoIA(cartaTopo);

    console.log(
      ehSuperTrunfo
        ? `[PartidaRoom] IA ${jogadorIA.nome} joga a Super Trunfo automaticamente (sala ${this.roomId})`
        : `[PartidaRoom] IA ${jogadorIA.nome} seleciona "${atributo}" automaticamente (sala ${this.roomId})`,
    );

    this.processarJogada(jogadorIA, atributo !== undefined ? { atributo } : undefined);
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
   * onDrop (Story 7.1) -- EXPLICACAO AUTORITATIVA do mecanismo
   * onDrop/onReconnect/onLeave/Deferred desta Room (unica fonte -- qualquer
   * outro comentario/teste que precisar dele so referencia este, nunca
   * reafirma os detalhes de novo). Chamado pelo Colyseus SO pra desconexao
   * NAO consentida (queda abrupta: rede caiu, WebSocket suspenso em
   * segundo plano, etc.) -- uma saida consentida (`client.leave()`,
   * `consented` default `true` no SDK) vai direto pro `onLeave`, nunca
   * passa por aqui.
   *
   * So oferece a janela de reconexao (`allowReconnection`) quando
   * `estado === "AguardandoJogadores"` -- exatamente o caso do incidente
   * real investigado (host caiu montando a Sala de Espera, sala destruida
   * antes dos convidados entrarem). Fora dessa fase (Partida ja em
   * andamento), no-op deliberado: o framework cai direto pro `onLeave` de
   * sempre, preservando o comportamento ja confirmado da Story 3.2
   * (assento vira IA permanentemente, AD-9, sem nenhum mecanismo de
   * reconexao) -- `onDrop` nunca interfere nesse caminho.
   *
   * O `return` (nao so a chamada) e' essencial: `allowReconnection` devolve
   * um `Deferred` que o framework espera antes de decidir destruir ou nao a
   * sala/assento. Se resolver (reconectou dentro da janela), o framework
   * nunca chama `onLeave` pra esse cliente -- o MESMO `sessionId`/entrada em
   * `state.jogadores` e' preservado sem nenhuma mutacao de estado precisar
   * "restaurar" nada (ver `onReconnect` abaixo). Se rejeitar (janela expira
   * sem reconexao), o framework chama `onLeave` automaticamente em seguida
   * -- por isso `onLeave` (mais abaixo) nao precisa de nenhuma mudanca de
   * logica pra este caso, so continua fazendo o que ja fazia.
   *
   * `sessoesReconectando` (Story 7.1, achado da revisao): rastreia quem
   * esta no meio dessa janela pro guard novo de `aoReceberIniciarPartida`
   * (acima) -- so adiciona o `sessionId` DEPOIS de confirmar que a chamada a
   * `allowReconnection` devolveu uma Deferred de verdade (nunca antes), e
   * remove assim que ela resolver OU rejeitar. `.catch(() => {})` primeiro
   * pra nunca deixar a rejeicao (janela expirada) virar uma unhandled
   * promise rejection -- so depois `.finally()` limpa o Set nos dois casos
   * (resultado do `.catch()` e' uma Promise de verdade, suporta
   * `.finally()`, ver `Deferred` em `@colyseus/core/build/utils/Utils.d.ts`).
   * Esse `.catch().finally()` e' um handler ADICIONAL sobre o mesmo
   * Deferred -- nao substitui nem interfere no que o framework ja observa
   * internamente pra decidir chamar `onReconnect` ou `onLeave`.
   *
   * O try/catch em volta da chamada de `allowReconnection` e' defensivo:
   * nunca visto lancar sincronamente na pratica (ela normalmente so
   * REJEITA a Deferred devolvida, ver `@colyseus/core/build/Room.mjs`), mas
   * se algum dia lancasse, adicionar o `sessionId` ANTES da chamada
   * deixaria ele preso pra sempre em `sessoesReconectando` (o
   * `.catch().finally()` que faria a limpeza nunca chegaria a ser
   * encadeado) -- bloqueando `iniciarPartida` da sala inteira sem
   * possibilidade de recuperacao. Guardando a Deferred numa variavel local
   * primeiro, o Set so e' tocado depois que ela existe de verdade.
   */
  onDrop(client: Client, code?: number) {
    if (this.state.estado !== "AguardandoJogadores") {
      return;
    }

    console.log(
      `[PartidaRoom] cliente caiu na Sala de Espera: ${client.sessionId} -- oferecendo ${JANELA_RECONEXAO_SALA_DE_ESPERA_S}s pra reconexao (sala ${this.roomId}, code ${code ?? "desconhecido"})`,
    );

    let reconexaoPendente: ReturnType<typeof this.allowReconnection>;
    try {
      reconexaoPendente = this.allowReconnection(client, JANELA_RECONEXAO_SALA_DE_ESPERA_S);
    } catch (erro) {
      console.error(
        `[PartidaRoom] onDrop: allowReconnection lancou sincronamente pra ${client.sessionId} (sala ${this.roomId}):`,
        erro,
      );
      return;
    }

    this.sessoesReconectando.add(client.sessionId);
    return reconexaoPendente
      .catch(() => {})
      .finally(() => this.sessoesReconectando.delete(client.sessionId));
  }

  /**
   * onReconnect (Story 7.1) -- so roda quando a `Deferred` de
   * `allowReconnection` (ver explicacao completa em `onDrop` acima)
   * resolve. So observabilidade -- o assento/entrada em `state.jogadores`
   * nunca saiu do lugar.
   */
  onReconnect(client: Client) {
    console.log(
      `[PartidaRoom] cliente reconectou na Sala de Espera: ${client.sessionId} (sala ${this.roomId})`,
    );
  }

  /**
   * onLeave (Story 1.4, bifurcado pela Story 3.2) -- o comportamento
   * depende inteiramente de `state.estado`:
   *
   * (Story 7.1) Numa desconexao NAO consentida (queda abrupta) durante
   * `AguardandoJogadores`, este metodo so roda se a janela de reconexao
   * expirar sem sucesso (ou nunca chegar a abrir -- `estado` ja diferente)
   * -- o framework tenta `onDrop` primeiro, e uma reconexao bem-sucedida
   * dentro da janela nunca chega aqui. Ver comentario de `onDrop` (acima)
   * pro mecanismo completo.
   *
   * Sala de Espera (`estado === "AguardandoJogadores"`): comportamento da
   * Story 1.4, inalterado -- remove o `Jogador` de `state.jogadores`. Como
   * a Partida ainda nao comecou nesta fase, nao ha Monte nem estado de jogo
   * pra preservar, a pessoa so some da lista. O `room.state` reativo
   * (Story 1.2/1.3) propaga a remocao pro frontend sem trabalho extra (ver
   * Design Notes do spec 1.2). Sem distincao entre saida limpa e
   * desconexao abrupta (`consented`) -- fora de escopo (ver Boundaries), e
   * sem reatribuir host se quem sai for o proprio host.
   *
   * Partida em andamento (qualquer outro `estado`, Story 3.2 Approach): o
   * `Jogador` NUNCA e removido -- vira `isIA = true` no lugar, preservando
   * Monte/posicao/nome exatamente como estavam ("continua de onde parou").
   * O `sessionId` antigo tambem e preservado (nunca reatribuido/limpo) --
   * fica inerte pra sempre, nunca mais bate com nenhum `Client` real, e
   * `this.lock()` (chamado desde `aoReceberIniciarPartida`, Story 2.1) ja
   * impede qualquer `joinById` novo nesta Room, entao o Jogador original
   * nunca reconsegue o assento de volta -- sem precisar de nenhuma logica
   * adicional aqui (Boundaries "Never": sem mecanismo de reconexao, AD-9).
   * `isHost` tambem nao e tocado -- nunca lido em nenhum lugar depois que a
   * Partida comeca (Boundaries "Never": sem reatribuicao de host).
   *
   * Se a desconexao aconteceu bem na hora da propria vez dele
   * (`estado === "AguardandoSelecao"` E `rodadaAtual.jogadorDaVez` e a
   * sessao que saiu, ainda nao tinha jogado nesta Rodada): agenda
   * `agendarJogadaDeIA` (Story 3.1, revisada pela Story 6.1 -- ja nao
   * despacha mais imediatamente, agora respeita a mesma `PAUSA_IA_MS` dos
   * outros 2 pontos de chamada), com o mesmo objeto `Jogador` ja resolvido
   * acima -- nunca um novo lookup por `sessionId`. Sem isso a Rodada
   * ficaria esperando pra sempre por um `jogarCarta` que nunca chegaria
   * (so um pouco mais devagar agora, pela pausa). Se a desconexao
   * aconteceu durante a pausa de revelacao (`"Revelando"`/
   * `"SuperTrunfoAcionado"`, ja jogou nesta Rodada), nada precisa disparar
   * agora -- `resolverRodada` (Stories 2.3+) ja encontra o `Jogador`
   * normalmente (nunca mais some de `state.jogadores`) quando a pausa
   * terminar, fechando de graca o risco residual documentado nas
   * Stories 2.3/2.5/2.6 ("vencedor desconectou durante a pausa de
   * revelacao").
   */
  onLeave(client: Client) {
    const indice = this.state.jogadores.findIndex(
      (jogador) => jogador.sessionId === client.sessionId,
    );
    if (indice === -1) {
      console.log(
        `[PartidaRoom] cliente saiu: ${client.sessionId} (nao encontrado em state.jogadores)`,
      );
      return;
    }

    if (this.state.estado === "AguardandoJogadores") {
      this.state.jogadores.splice(indice, 1);
      console.log(`[PartidaRoom] cliente saiu: ${client.sessionId}`);
      return;
    }

    const jogador = this.state.jogadores[indice];
    jogador.isIA = true;
    console.log(
      `[PartidaRoom] cliente desconectou durante Partida em andamento: ${client.sessionId} (${jogador.nome}) -- assento convertido pra IA, Monte preservado (sala ${this.roomId})`,
    );

    if (
      this.state.estado === "AguardandoSelecao" &&
      this.state.rodadaAtual.jogadorDaVez === client.sessionId
    ) {
      this.agendarJogadaDeIA(jogador);
    }
  }

  onDispose() {
    console.log(`[PartidaRoom] sala destruida: ${this.roomId}`);
  }
}
