import { Schema, type } from "@colyseus/schema";

/**
 * Carta -- unidade do Baralho (Glossário), fonte de verdade em
 * `docs/carros_specs.csv` (Story 2.1). Ver `backend/src/game/baralho.ts`
 * pro parse do CSV pra instâncias desta classe.
 *
 * Campos verbatim do CSV/Glossário -- sem duplicar/renomear o significado
 * dos dados (Boundaries da Story 2.1). Os 7 Atributos numéricos (RF01.4)
 * mapeiam 1:1 pras colunas do CSV, comentadas ao lado de cada campo; a
 * config de comparação (`inverso`, AD-7) é responsabilidade de
 * `backend/src/game/atributos.ts` (Story 2.2), não desta classe.
 *
 * Não é marcada com `@view()` -- o anti-cheat (AD-3) acontece no campo
 * `Jogador.monte` (o array inteiro é invisível por padrão), não Carta por
 * Carta: uma vez que o servidor conceda visibilidade de uma instância
 * específica via `client.view.add(carta)`, todos os campos dela ficam
 * visíveis pra quem recebeu a concessão -- é exatamente isso que permite
 * "a Carta do topo inteira" ficar visível ao dono (e, na Story 2.2/AD-3,
 * a todos durante `Revelando`).
 */
export class Carta extends Schema {
  @type("string") id: string = ""; // ex: "2A" (Grupo 2 + Letra A)
  @type("number") grupo: number = 0; // 1-8
  @type("string") letra: string = ""; // "A" | "B" | "C" | "D"
  @type("string") pais: string = "";
  @type("boolean") superTrunfo: boolean = false; // so a "2A" e' true (conteudo, nao decisao de codigo)
  @type("string") imagem: string = ""; // nome do arquivo slugificado em frontend/src/assets/carros/ (Story 5.4)

  // Os 7 Atributos numericos (RF01.4) -- nomes de campo em camelCase,
  // mapeados 1:1 pras colunas de `docs/carros_specs.csv`.
  @type("number") velocidadeMaxima: number = 0; // "Velocidade Maxima (km/h)"
  @type("number") potenciaCv: number = 0; // "Potencia (CV)"
  @type("number") potenciaHp: number = 0; // "Potencia (HP)"
  @type("number") rpmMaximo: number = 0; // "RPM Maximo"
  @type("number") cilindrada: number = 0; // "Cilindrada (cm3)"
  @type("number") aceleracao: number = 0; // "Aceleracao 0-100 km/h (s)" -- inverso (AD-7, Story 2.2)
  @type("number") qtdCilindros: number = 0; // "Qtd Cilindros"
}
