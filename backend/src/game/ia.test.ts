import { afterEach, describe, expect, it, vi } from "vitest";
import { Carta } from "../schema/Carta.ts";
import { ATRIBUTOS } from "./atributos.ts";
import { decidirAtributoIA } from "./ia.ts";

/**
 * Camada unitaria (AD-12) de `decidirAtributoIA` (Story 3.1) -- funcao
 * pura, sem rede/Room. Mesma filosofia de `turno.test.ts`/`superTrunfo.test.ts`:
 * cobre a Matrix do spec ("decidirAtributoIA pura, sempre devolve uma das 7
 * chaves validas de ATRIBUTOS") tanto com aleatoriedade real (repetido
 * muitas vezes) quanto com `Math.random` mockado pra cravar cada indice.
 */
describe("ia -- decidirAtributoIA", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sempre devolve uma das 7 chaves validas de ATRIBUTOS, rodado muitas vezes com aleatoriedade real", () => {
    const chavesValidas = new Set(ATRIBUTOS.map((atributo) => atributo.chave));
    const carta = new Carta();

    for (let indice = 0; indice < 500; indice++) {
      const resultado = decidirAtributoIA(carta);
      expect(chavesValidas.has(resultado)).toBe(true);
    }
  });

  it("com aleatoriedade real rodada muitas vezes, eventualmente cobre TODAS as 7 chaves (distribuicao nao-degenerada)", () => {
    const carta = new Carta();
    const chavesVistas = new Set<string>();

    for (let indice = 0; indice < 1000; indice++) {
      chavesVistas.add(decidirAtributoIA(carta));
    }

    expect(chavesVistas.size).toBe(ATRIBUTOS.length);
  });

  it.each(ATRIBUTOS.map((atributo, indice) => [indice, atributo.chave] as const))(
    "Math.random mockado pro indice %i mapeia exatamente pra ATRIBUTOS[%i].chave (%s)",
    (indice, chaveEsperada) => {
      // Math.floor((indice / 7) * 7) === indice pra qualquer indice inteiro
      // 0..6 -- fracao minima acima do limiar de cada indice, sem cair no
      // proximo por erro de ponto flutuante.
      const fracao = (indice + 0.001) / ATRIBUTOS.length;
      vi.spyOn(Math, "random").mockReturnValue(fracao);

      const carta = new Carta();
      expect(decidirAtributoIA(carta)).toBe(chaveEsperada);
    },
  );

  it("Math.random no limite superior (proximo de 1) ainda mapeia pro ultimo indice valido, sem estourar o array", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    const carta = new Carta();
    const resultado = decidirAtributoIA(carta);

    expect(resultado).toBe(ATRIBUTOS[ATRIBUTOS.length - 1].chave);
  });

  it("Math.random no limite inferior (0) mapeia pro primeiro indice", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const carta = new Carta();
    expect(decidirAtributoIA(carta)).toBe(ATRIBUTOS[0].chave);
  });

  it("nunca avalia a propria Carta recebida -- o resultado independe do conteudo dela (estrategia deliberadamente simples, Boundaries do spec)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const cartaQualquer = new Carta();
    cartaQualquer.id = "2A";
    cartaQualquer.superTrunfo = true;
    cartaQualquer.velocidadeMaxima = 999999;

    const cartaVazia = new Carta();

    expect(decidirAtributoIA(cartaQualquer)).toBe(decidirAtributoIA(cartaVazia));
  });
});
