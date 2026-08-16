/**
 * atributos.ts -- config estatica dos 7 Atributos do Baralho (AD-7, Story
 * 2.2). Cada `chave` bate 1:1 com o nome do campo numerico correspondente
 * em `backend/src/schema/Carta.ts` -- usada tanto pra validar o `atributo`
 * recebido em `jogarCarta` (`PartidaRoom.ts`) quanto, em Stories futuras
 * (2.3+), pra comparacao de valores entre Cartas.
 *
 * `inverso: true` so em "aceleracao" (Aceleracao 0-100 km/h) -- o unico
 * Atributo do conjunto atual do Baralho onde MENOR valor vence
 * (epic-2-context.md > Technical Decisions: "Atributos inversos sao dado,
 * nao `if` hardcoded"). Os outros 6 sao `inverso: false`.
 */
export interface Atributo {
  chave: string;
  rotulo: string;
  inverso: boolean;
}

export const ATRIBUTOS: Atributo[] = [
  { chave: "velocidadeMaxima", rotulo: "Velocidade Máxima", inverso: false },
  { chave: "potenciaCv", rotulo: "Potência (CV)", inverso: false },
  { chave: "potenciaHp", rotulo: "Potência (HP)", inverso: false },
  { chave: "rpmMaximo", rotulo: "RPM Máximo", inverso: false },
  { chave: "cilindrada", rotulo: "Cilindrada", inverso: false },
  { chave: "aceleracao", rotulo: "Aceleração 0-100 km/h", inverso: true },
  { chave: "qtdCilindros", rotulo: "Qtd. Cilindros", inverso: false },
];

/**
 * atributoValido -- true so se `chave` bate com uma das 7 entradas de
 * `ATRIBUTOS`. Usado por `PartidaRoom.jogarCarta` (Story 2.2) pra rejeitar
 * `atributo` invalido/ausente (Boundaries: "precisa ser uma chave valida
 * de atributos.ts; invalido/ausente e rejeitado do mesmo jeito").
 */
export function atributoValido(chave: string | undefined): chave is string {
  return typeof chave === "string" && ATRIBUTOS.some((atributo) => atributo.chave === chave);
}
