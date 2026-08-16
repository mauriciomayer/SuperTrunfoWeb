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
}

/** Bandeiras dos paises presentes em `docs/carros_specs.csv` -- fallback generico pra qualquer outro. */
const BANDEIRAS_POR_PAIS: Record<string, string> = {
  Alemanha: "🇩🇪",
  "Reino Unido": "🇬🇧",
  Italia: "🇮🇹",
  Franca: "🇫🇷",
  "Estados Unidos": "🇺🇸",
};

const ATRIBUTOS: Array<{ rotulo: string; valor: (carta: CartaFrente) => string }> = [
  { rotulo: "Velocidade Máxima", valor: (carta) => `${carta.velocidadeMaxima} km/h` },
  { rotulo: "Potência (CV)", valor: (carta) => `${carta.potenciaCv} CV` },
  { rotulo: "Potência (HP)", valor: (carta) => `${carta.potenciaHp} HP` },
  { rotulo: "RPM Máximo", valor: (carta) => `${carta.rpmMaximo} RPM` },
  { rotulo: "Cilindrada", valor: (carta) => `${carta.cilindrada} cm³` },
  { rotulo: "Aceleração 0-100 km/h", valor: (carta) => `${carta.aceleracao} s` },
  { rotulo: "Qtd. Cilindros", valor: (carta) => `${carta.qtdCilindros}` },
];

/**
 * Carta (frente) -- DESIGN.md > Componentes ("Carta"): moldura vermelha
 * grossa (dourada + selo estrelado se Super Trunfo), foto placeholder,
 * bandeira do país + badge Grupo/Letra sobre a foto. Sem faixa de
 * cabeçalho nem nome do carro (removidos por decisão de design, ver
 * Boundaries da Story 2.1).
 *
 * Só leitura nesta história -- nenhuma Linha de Atributo é clicável ainda
 * (seleção de Atributo é Story 2.2); aqui é sempre a Carta do topo do
 * próprio Monte, exibida por inteiro (é a única Carta que o servidor
 * concede visibilidade completa via `StateView`, ver `PartidaRoom.ts`).
 */
export function Carta({ carta }: CartaProps) {
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
          <div className="carta-frente__linha-atributo" key={atributo.rotulo}>
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
