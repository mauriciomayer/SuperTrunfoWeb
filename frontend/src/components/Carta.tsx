import "./Carta.css";
import bandeiraAlemanha from "../assets/bandeiras/alemanha.svg";
import bandeiraReinoUnido from "../assets/bandeiras/reino-unido.svg";
import bandeiraItalia from "../assets/bandeiras/italia.svg";
import bandeiraFranca from "../assets/bandeiras/franca.svg";
import bandeiraEstadosUnidos from "../assets/bandeiras/estados-unidos.svg";

/**
 * Forma da `Carta` do lado do frontend -- espelha `backend/src/schema/Carta.ts`
 * de proposito (AD-10: nenhum import de codigo entre os pacotes, so rede).
 */
export interface CartaFrente {
  id: string;
  grupo: number;
  letra: string;
  pais: string;
  imagem: string;
  modelo: string;
  superTrunfo: boolean;
  velocidadeMaxima: number;
  potenciaCv: number;
  potenciaHp: number;
  rpmMaximo: number;
  cilindrada: number;
  aceleracao: number;
  qtdCilindros: number;
}

interface CartaProps {
  carta: CartaFrente;
  /**
   * Linha de Atributo vira clicavel so quando `true` -- decidido por quem
   * renderiza (`MesaDeJogo.tsx`, Story 2.2): `estado === "AguardandoSelecao"`
   * e `jogadorDaVez` (via `rodadaAtual`) e' o proprio `room.sessionId`.
   * Nunca uma decisao tomada aqui dentro (Boundaries: "fora da propria
   * vez, a Linha de Atributo nunca e clicavel, nem na propria Carta").
   */
  clicavel?: boolean;
  /**
   * Disparado com a `chave` do Atributo clicado -- sem confirmacao
   * intermediaria (UX-DR4). Story 2.4: quando `carta.superTrunfo === true`,
   * as Linhas de Atributo nao sao interativas (sem sentido pra essa Carta,
   * o servidor ignora `atributo` de qualquer jeito -- Boundaries "Always"),
   * a Carta INTEIRA fica clicavel no lugar e este callback e chamado SEM
   * argumento (jogada de Super Trunfo, `jogarCarta(room)`).
   */
  onSelecionarAtributo?: (atributo?: string) => void;
  /**
   * Reservado pra Story 2.3 destacar visualmente o Atributo selecionado
   * apos a revelacao -- so recebe a prop nesta Story (2.2), sem uso
   * visual alem do clique ainda.
   */
  atributoDestacado?: string;
  /**
   * Story 2.4 -- moldura/glow distinto pra Carta INTEIRA (nunca so uma
   * Linha, por isso nao reusa `atributoDestacado`): usado por
   * `MesaDeJogo.tsx` pra destacar a Carta "A" que anulou o Super Trunfo
   * como "a vencedora real" (UX, Boundaries "Always"), na janela em que
   * ela ainda esta visivel (`estado === "SuperTrunfoAcionado"`).
   */
  destacada?: boolean;
}

/**
 * Bandeiras dos paises presentes em `docs/carros_specs.csv`, como asset SVG
 * real (self-hosted em `src/assets/bandeiras/`, nunca CDN externo em
 * runtime nem emoji de fonte do SO -- Story 5.2: emoji de bandeira nao
 * renderiza corretamente no Windows). Cada valor e' a URL resolvida pelo
 * Vite pro arquivo importado. Fonte: pacote `flag-icons` (MIT), SVGs
 * copiados pro repositorio -- nao e' dependencia de runtime.
 * Pais sem entrada aqui cai no fallback emoji "🌍" (nunca deveria
 * acontecer com o Baralho real de 32 Cartas).
 */
const BANDEIRAS_POR_PAIS: Record<string, string> = {
  Alemanha: bandeiraAlemanha,
  "Reino Unido": bandeiraReinoUnido,
  Italia: bandeiraItalia,
  Franca: bandeiraFranca,
  "Estados Unidos": bandeiraEstadosUnidos,
};

/**
 * Fotos reais dos carros (Story 5.4) -- as 32 fotos em
 * `src/assets/carros/` sao carregadas de uma vez via `import.meta.glob`
 * (eager) em vez de 32 imports nomeados um a um (escala 6x maior que
 * `BANDEIRAS_POR_PAIS`, ficaria verboso demais do mesmo jeito). Cada chave
 * do glob e' o caminho relativo (ex: `"../assets/carros/ferrari-812-superfast.jpg"`);
 * extrai so o nome do arquivo pra montar o mapa usado no lookup por
 * `carta.imagem` (mesmo valor que `docs/carros_specs.csv` grava na coluna
 * `Imagem`, propagado via `baralho.ts` -> `Carta.ts` -> aqui).
 */
const MODULOS_FOTOS_CARROS = import.meta.glob("../assets/carros/*", {
  eager: true,
}) as Record<string, { default: string }>;

const FOTOS_POR_ARQUIVO: Record<string, string> = Object.fromEntries(
  Object.entries(MODULOS_FOTOS_CARROS).map(([caminho, modulo]) => [
    caminho.split("/").pop() as string,
    modulo.default,
  ]),
);

/**
 * Fallback residual pro pais sem entrada em `BANDEIRAS_POR_PAIS` -- estado
 * defensivo/inalcancavel com o Baralho real de 32 Cartas (os 5 paises de
 * `docs/carros_specs.csv` batem 1:1 com as chaves acima hoje), mas
 * mantido caso um CSV futuro introduza um pais novo sem atualizar o mapa.
 * `console.warn` segue o mesmo padrao "falha cedo e alto" ja usado pra
 * estados defensivos/inalcancaveis em `PartidaRoom.ts` (backend) -- sem
 * isso, esse caminho degradaria silenciosamente.
 */
function renderizarFallbackBandeira(pais: string) {
  console.warn(`[Carta] pais sem bandeira mapeada em BANDEIRAS_POR_PAIS: "${pais}"`);
  return (
    <span className="carta-frente__bandeira-fallback" aria-hidden="true">
      🌍
    </span>
  );
}

/**
 * Achado de revisao (Story 5.4): distingue "carta.imagem vazio" (residual,
 * nunca deveria acontecer com o Baralho real -- ja coberto pela validacao
 * de `carregarBaralho`) de "carta.imagem preenchido mas sem entrada em
 * `FOTOS_POR_ARQUIVO`" (um mismatch de verdade entre o CSV e os arquivos
 * copiados pra `src/assets/carros/` -- ex: renomear um arquivo ou corrigir
 * um typo de um lado sem atualizar o outro). So o segundo caso e um sinal
 * acionavel, entao so ele avisa -- mesmo padrao "falha cedo e alto" de
 * `renderizarFallbackBandeira` acima, pro mesmo tipo de estado defensivo.
 */
function resolverFotoCarro(imagem: string): string | undefined {
  if (!imagem) return undefined;

  const foto = FOTOS_POR_ARQUIVO[imagem];
  if (foto === undefined) {
    console.warn(`[Carta] carta.imagem sem foto mapeada em FOTOS_POR_ARQUIVO: "${imagem}"`);
  }
  return foto;
}

/**
 * `chave` bate 1:1 com `backend/src/game/atributos.ts` (AD-7) -- e o valor
 * mandado em `onSelecionarAtributo`/`jogarCarta({ atributo: chave })`
 * quando a Linha de Atributo e clicada (Story 2.2). Exportada pra
 * `MesaDeJogo.tsx` (Story 2.3) resolver o `rotulo` legivel do `atributo`
 * (`chave`) que volta em `estado.ultimoResultado.atributo` -- reuso
 * dentro do proprio frontend, sem violar AD-10 (que so proibe import de
 * codigo ENTRE os pacotes backend/frontend).
 */
export const ATRIBUTOS: Array<{ chave: string; rotulo: string; valor: (carta: CartaFrente) => string }> =
  [
    { chave: "velocidadeMaxima", rotulo: "Velocidade Máxima", valor: (carta) => `${carta.velocidadeMaxima} km/h` },
    { chave: "potenciaCv", rotulo: "Potência (CV)", valor: (carta) => `${carta.potenciaCv} CV` },
    { chave: "potenciaHp", rotulo: "Potência (HP)", valor: (carta) => `${carta.potenciaHp} HP` },
    { chave: "rpmMaximo", rotulo: "RPM Máximo", valor: (carta) => `${carta.rpmMaximo} RPM` },
    { chave: "cilindrada", rotulo: "Cilindrada", valor: (carta) => `${carta.cilindrada} cm³` },
    { chave: "aceleracao", rotulo: "Aceleração 0-100 km/h", valor: (carta) => `${carta.aceleracao} s` },
    { chave: "qtdCilindros", rotulo: "Qtd. Cilindros", valor: (carta) => `${carta.qtdCilindros}` },
  ];

/**
 * Carta (frente) -- DESIGN.md > Componentes ("Carta"): moldura vermelha
 * grossa (dourada + selo estrelado se Super Trunfo), foto placeholder,
 * bandeira do país + badge Grupo/Letra sobre a foto. Sem faixa de
 * cabeçalho (removida por decisão de design, ver Boundaries da Story 2.1).
 * O nome do modelo do carro (`carta.modelo`), removido junto na Story 2.1,
 * voltou na Story 5.7 -- exibido entre a foto e a primeira Linha de
 * Atributo, jogadores reclamaram que precisavam decorar o código
 * Grupo/Letra sem ele.
 *
 * Linha de Atributo fica clicável quando `clicavel` (Story 2.2, decidido
 * por quem renderiza -- nunca por esta Carta olhando pro próprio estado):
 * clique único chama `onSelecionarAtributo(chave)`, sem confirmação
 * intermediária (UX-DR4). `atributoDestacado` é reservado pra Story 2.3
 * destacar visualmente o Atributo já selecionado -- só marcado via
 * `data-destacado` nesta história, sem estilo visual próprio ainda.
 * `destacada` (Story 2.4) destaca a Carta INTEIRA (moldura/glow distinto,
 * `.carta-frente--destacada`) -- usado pra sinalizar a Carta "A" que
 * anulou o Super Trunfo como "a vencedora real", decidido por quem
 * renderiza (`MesaDeJogo.tsx`), nunca por esta Carta.
 *
 * Story 2.4 -- Carta Super Trunfo: nenhuma Linha de Atributo fica
 * clicável (o servidor ignora `atributo` de qualquer jeito pra essa
 * Carta, mostrar as Linhas como clicáveis seria uma mentira visual sobre
 * o que o clique faz); a Carta INTEIRA fica clicável no lugar quando
 * `clicavel`, disparando `onSelecionarAtributo()` sem argumento (jogada
 * honesta de Super Trunfo -- achado de revisão: antes desta correção não
 * havia forma correta de jogar essa Carta pela UI).
 */
export function Carta({
  carta,
  clicavel = false,
  onSelecionarAtributo,
  atributoDestacado,
  destacada = false,
}: CartaProps) {
  const bandeiraSrc = BANDEIRAS_POR_PAIS[carta.pais];
  // Story 5.4: foto real quando `carta.imagem` mapear pra um arquivo
  // conhecido em `FOTOS_POR_ARQUIVO`; fallback pro placeholder atual (🚗 +
  // "foto em breve") quando vier vazio (residual -- nao deveria acontecer
  // com o Baralho real de 32 Cartas) ou nao mapeado.
  const fotoSrc = resolverFotoCarro(carta.imagem);

  // Story 2.4: as duas formas de "clicável" são mutuamente exclusivas --
  // ou as Linhas de Atributo (Carta normal), ou a Carta inteira (Super
  // Trunfo), nunca as duas ao mesmo tempo.
  const linhasClicaveis = clicavel && !carta.superTrunfo;
  const cartaInteiraClicavel = clicavel && carta.superTrunfo;

  function aoClicarNaCartaInteira() {
    onSelecionarAtributo?.();
  }

  return (
    <div
      className={`carta-frente${carta.superTrunfo ? " carta-frente--supertrunfo" : ""}${destacada ? " carta-frente--destacada" : ""}${cartaInteiraClicavel ? " carta-frente--clicavel" : ""}`}
      data-testid="carta-frente"
      data-destacada={destacada ? "true" : undefined}
      role={cartaInteiraClicavel ? "button" : undefined}
      tabIndex={cartaInteiraClicavel ? 0 : undefined}
      aria-label={cartaInteiraClicavel ? "Jogar a Carta Super Trunfo" : undefined}
      onClick={cartaInteiraClicavel ? aoClicarNaCartaInteira : undefined}
      onKeyDown={
        cartaInteiraClicavel
          ? (evento) => {
              // Ignora auto-repeat do teclado (tecla segurada) -- mesmo
              // guard da Linha de Atributo (Story 2.2).
              if (evento.repeat) return;
              if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                aoClicarNaCartaInteira();
              }
            }
          : undefined
      }
    >
      <div className="carta-frente__foto">
        <span className="carta-frente__badge-pais" title={carta.pais} aria-label={carta.pais}>
          {bandeiraSrc ? (
            <img
              className="carta-frente__bandeira-img"
              src={bandeiraSrc}
              alt=""
              width={20}
              height={15}
            />
          ) : (
            // Fallback residual pra pais nao mapeado (nunca deveria
            // acontecer com o Baralho real de 32 Cartas -- os 5 paises de
            // `docs/carros_specs.csv` batem 1:1 com `BANDEIRAS_POR_PAIS`
            // hoje) -- emoji generico, ja que nao ha SVG de "mundo"
            // equivalente entre as 5 bandeiras copiadas.
            renderizarFallbackBandeira(carta.pais)
          )}
        </span>
        <span className="carta-frente__badge-id">
          {carta.grupo}
          {carta.letra}
        </span>
        {fotoSrc ? (
          <img
            className="carta-frente__foto-img"
            src={fotoSrc}
            alt=""
            data-testid="carta-frente-foto"
          />
        ) : (
          <>
            <span className="carta-frente__foto-placeholder" aria-hidden="true">
              🚗
            </span>
            <span className="carta-frente__foto-texto">foto em breve</span>
          </>
        )}
      </div>
      <p className="carta-frente__modelo" title={carta.modelo}>
        {carta.modelo}
      </p>
      <dl className="carta-frente__atributos">
        {ATRIBUTOS.map((atributo) => (
          <div
            className={`carta-frente__linha-atributo${linhasClicaveis ? " carta-frente__linha-atributo--clicavel" : ""}`}
            key={atributo.rotulo}
            data-testid={`linha-atributo-${atributo.chave}`}
            data-destacado={atributo.chave === atributoDestacado ? "true" : undefined}
            role={linhasClicaveis ? "button" : undefined}
            tabIndex={linhasClicaveis ? 0 : undefined}
            onClick={linhasClicaveis ? () => onSelecionarAtributo?.(atributo.chave) : undefined}
            onKeyDown={
              linhasClicaveis
                ? (evento) => {
                    // Ignora auto-repeat do teclado (tecla segurada) -- sem
                    // isso, segurar Enter/espaco dispara
                    // `onSelecionarAtributo` repetidamente.
                    if (evento.repeat) return;
                    if (evento.key === "Enter" || evento.key === " ") {
                      evento.preventDefault();
                      onSelecionarAtributo?.(atributo.chave);
                    }
                  }
                : undefined
            }
          >
            <dt>{atributo.rotulo}</dt>
            <dd>{atributo.valor(carta)}</dd>
          </div>
        ))}
      </dl>
      {carta.superTrunfo && (
        <span className="carta-frente__selo-supertrunfo">★ SUPER TRUNFO</span>
      )}
    </div>
  );
}
