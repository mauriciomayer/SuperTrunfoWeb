import "./Carta.css";

/**
 * Forma da `Carta` do lado do frontend -- espelha `backend/src/schema/Carta.ts`
 * de proposito (AD-10: nenhum import de codigo entre os pacotes, so rede).
 */
export interface CartaFrente {
  id: string;
  grupo: number;
  letra: string;
  pais: string;
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
  /** Disparado com a `chave` do Atributo clicado -- sem confirmacao intermediaria (UX-DR4). */
  onSelecionarAtributo?: (atributo: string) => void;
  /**
   * Reservado pra Story 2.3 destacar visualmente o Atributo selecionado
   * apos a revelacao -- so recebe a prop nesta Story (2.2), sem uso
   * visual alem do clique ainda.
   */
  atributoDestacado?: string;
}

/** Bandeiras dos paises presentes em `docs/carros_specs.csv` -- fallback generico pra qualquer outro. */
const BANDEIRAS_POR_PAIS: Record<string, string> = {
  Alemanha: "🇩🇪",
  "Reino Unido": "🇬🇧",
  Italia: "🇮🇹",
  Franca: "🇫🇷",
  "Estados Unidos": "🇺🇸",
};

/**
 * `chave` bate 1:1 com `backend/src/game/atributos.ts` (AD-7) -- e o valor
 * mandado em `onSelecionarAtributo`/`jogarCarta({ atributo: chave })`
 * quando a Linha de Atributo e clicada (Story 2.2).
 */
const ATRIBUTOS: Array<{ chave: string; rotulo: string; valor: (carta: CartaFrente) => string }> =
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
 * cabeçalho nem nome do carro (removidos por decisão de design, ver
 * Boundaries da Story 2.1).
 *
 * Linha de Atributo fica clicável quando `clicavel` (Story 2.2, decidido
 * por quem renderiza -- nunca por esta Carta olhando pro próprio estado):
 * clique único chama `onSelecionarAtributo(chave)`, sem confirmação
 * intermediária (UX-DR4). `atributoDestacado` é reservado pra Story 2.3
 * destacar visualmente o Atributo já selecionado -- só marcado via
 * `data-destacado` nesta história, sem estilo visual próprio ainda.
 */
export function Carta({
  carta,
  clicavel = false,
  onSelecionarAtributo,
  atributoDestacado,
}: CartaProps) {
  const bandeira = BANDEIRAS_POR_PAIS[carta.pais] ?? "🌍";

  return (
    <div
      className={`carta-frente${carta.superTrunfo ? " carta-frente--supertrunfo" : ""}`}
      data-testid="carta-frente"
    >
      <div className="carta-frente__foto">
        <span className="carta-frente__badge-pais" title={carta.pais} aria-label={carta.pais}>
          {bandeira}
        </span>
        <span className="carta-frente__badge-id">
          {carta.grupo}
          {carta.letra}
        </span>
        <span className="carta-frente__foto-placeholder" aria-hidden="true">
          🚗
        </span>
        <span className="carta-frente__foto-texto">foto em breve</span>
      </div>
      <dl className="carta-frente__atributos">
        {ATRIBUTOS.map((atributo) => (
          <div
            className={`carta-frente__linha-atributo${clicavel ? " carta-frente__linha-atributo--clicavel" : ""}`}
            key={atributo.rotulo}
            data-testid={`linha-atributo-${atributo.chave}`}
            data-destacado={atributo.chave === atributoDestacado ? "true" : undefined}
            role={clicavel ? "button" : undefined}
            tabIndex={clicavel ? 0 : undefined}
            onClick={clicavel ? () => onSelecionarAtributo?.(atributo.chave) : undefined}
            onKeyDown={
              clicavel
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
