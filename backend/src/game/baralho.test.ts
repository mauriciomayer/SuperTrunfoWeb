import { writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { carregarBaralho, distribuir, embaralhar } from "./baralho.ts";

/**
 * Diretorio das fotos reais dos carros (Story 5.4), resolvido relativo a
 * este arquivo -- mesmo truque de tres niveis de `resolverCsvPadrao` em
 * `baralho.ts`, so que apontando pra `frontend/src/assets/carros/` em vez
 * de `docs/carros_specs.csv`.
 */
const DIRETORIO_FOTOS_CARROS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../frontend/src/assets/carros",
);

const CABECALHO_CSV =
  "ID,Grupo,Letra,SuperTrunfo,Modelo,Imagem,Pais,Velocidade Maxima (km/h),Potencia (CV),Potencia (HP),RPM Maximo,Cilindrada (cm3),Aceleracao 0-100 km/h (s),Qtd Cilindros";

/**
 * Escreve um fixture de CSV temporario e devolve o caminho -- usado pelos
 * testes de validacao de `carregarBaralho` que precisam de um CSV
 * deliberadamente invalido, sem depender de estragar o CSV real do repo.
 */
function escreverCsvTemporario(linhasDeDados: string[]): string {
  const arquivoTemporario = path.join(
    tmpdir(),
    `baralho-invalido-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`,
  );
  writeFileSync(arquivoTemporario, [CABECALHO_CSV, ...linhasDeDados].join("\n") + "\n");
  return arquivoTemporario;
}

/**
 * Camada unitaria (AD-12) do Baralho: `carregarBaralho`/`embaralhar`/
 * `distribuir` sao funcoes puras, testaveis sem subir uma Room -- base de
 * tudo que a Story 2.1 constroi em cima (Code Map).
 */
describe("baralho -- carregarBaralho", () => {
  it("le docs/carros_specs.csv e devolve exatamente 32 Cartas", () => {
    const baralho = carregarBaralho();
    expect(baralho).toHaveLength(32);
  });

  it("marca exatamente 1 Carta com a flag Super Trunfo (a 2A, RF01.5)", () => {
    const baralho = carregarBaralho();
    const superTrunfos = baralho.filter((carta) => carta.superTrunfo);

    expect(superTrunfos).toHaveLength(1);
    expect(superTrunfos[0].id).toBe("2A");
  });

  it("cada Carta tem ID unico e os 7 Atributos numericos preenchidos (RF01.2/RF01.4)", () => {
    const baralho = carregarBaralho();
    const ids = baralho.map((carta) => carta.id);

    expect(new Set(ids).size).toBe(32);

    for (const carta of baralho) {
      expect(carta.grupo).toBeGreaterThanOrEqual(1);
      expect(carta.grupo).toBeLessThanOrEqual(8);
      expect(["A", "B", "C", "D"]).toContain(carta.letra);
      expect(carta.pais.length).toBeGreaterThan(0);
      expect(Number.isNaN(carta.velocidadeMaxima)).toBe(false);
      expect(Number.isNaN(carta.potenciaCv)).toBe(false);
      expect(Number.isNaN(carta.potenciaHp)).toBe(false);
      expect(Number.isNaN(carta.rpmMaximo)).toBe(false);
      expect(Number.isNaN(carta.cilindrada)).toBe(false);
      expect(Number.isNaN(carta.aceleracao)).toBe(false);
      expect(Number.isNaN(carta.qtdCilindros)).toBe(false);
    }
  });

  it("cada Carta carregada do CSV real tem o campo imagem preenchido (Story 5.4, FR-28)", () => {
    const baralho = carregarBaralho();

    for (const carta of baralho) {
      expect(carta.imagem.length).toBeGreaterThan(0);
    }
  });

  /**
   * Achado de revisao (Story 5.4): o teste acima so confere que `imagem`
   * vem NAO-VAZIO -- nunca cruza esse valor contra os arquivos de verdade
   * em `frontend/src/assets/carros/`. Um rename futuro de arquivo (ou
   * correcao de typo so de um lado, CSV ou nome de arquivo) deixaria o
   * campo preenchido (teste acima continua passando) mas sem resolver pra
   * foto nenhuma -- a UI cairia no placeholder 🚗 em silencio total, sem
   * nenhum sinal de teste/CI. Este teste fecha essa lacuna: carrega o
   * Baralho real e confere, carta por carta, que `imagem` bate com um
   * arquivo que existe de verdade no disco.
   */
  it("o campo imagem de cada Carta do CSV real bate com um arquivo existente em frontend/src/assets/carros/", () => {
    const baralho = carregarBaralho();
    const arquivosExistentes = new Set(readdirSync(DIRETORIO_FOTOS_CARROS));

    for (const carta of baralho) {
      expect(arquivosExistentes.has(carta.imagem)).toBe(true);
    }
  });

  it("lanca erro se o CSV nao tiver exatamente 32 linhas de dados", () => {
    // Fixture minusculo (so 2 Cartas) -- prova que a validacao de tamanho
    // do Baralho funciona, sem depender de estragar o CSV real do repo.
    const arquivoTemporario = escreverCsvTemporario([
      "1A,1,A,false,Carro X,carro-x.jpg,Alemanha,300,500,493,7000,4000,3.5,8",
      "1B,1,B,false,Carro Y,carro-y.jpg,Alemanha,300,500,493,7000,4000,3.5,8",
    ]);

    expect(() => carregarBaralho(arquivoTemporario)).toThrow(/32 Cartas/);

    unlinkSync(arquivoTemporario);
  });

  it("lanca erro identificando a linha se alguma linha de dados tiver numero de colunas diferente do cabecalho", () => {
    // 32 linhas no total (pra nao disparar a validacao de contagem
    // primeiro), mas a linha 15 (indice 13, 0-based) tem uma coluna a
    // menos -- exatamente o tipo de erro silencioso (campos vindo
    // `undefined`/`NaN`) que essa validacao evita.
    const linhasValidas = Array.from(
      { length: 31 },
      (_, indice) => `X${indice},1,A,false,Carro,carro.jpg,Alemanha,300,500,493,7000,4000,3.5,8`,
    );
    const linhaDesalinhada = "X31,1,A,false,Carro,carro.jpg,Alemanha,300,500,493,7000,4000,3.5"; // falta 1 coluna
    const arquivoTemporario = escreverCsvTemporario([
      ...linhasValidas.slice(0, 13),
      linhaDesalinhada,
      ...linhasValidas.slice(13),
    ]);

    expect(() => carregarBaralho(arquivoTemporario)).toThrow(/linha 15/);

    unlinkSync(arquivoTemporario);
  });

  it("lanca erro se o CSV nao tiver exatamente 1 Carta com a flag Super Trunfo (RF01.5)", () => {
    // 32 linhas validas, mas nenhuma com SuperTrunfo=true.
    const linhasSemSuperTrunfo = Array.from(
      { length: 32 },
      (_, indice) => `X${indice},1,A,false,Carro,carro.jpg,Alemanha,300,500,493,7000,4000,3.5,8`,
    );
    const arquivoTemporario = escreverCsvTemporario(linhasSemSuperTrunfo);

    expect(() => carregarBaralho(arquivoTemporario)).toThrow(/Super Trunfo/);

    unlinkSync(arquivoTemporario);
  });
});

describe("baralho -- embaralhar", () => {
  it("nao devolve a mesma ordem do array original (Fisher-Yates, aleatorio)", () => {
    const baralho = carregarBaralho();
    const embaralhado = embaralhar(baralho);

    // Probabilidade de 32 elementos embaralhados calharem na mesma ordem e
    // desprezivel (1 em 32!) -- teste estavel na pratica.
    expect(embaralhado.map((carta) => carta.id)).not.toEqual(baralho.map((carta) => carta.id));
  });

  it("mantem a mesma composicao de Cartas (mesmo conjunto de IDs, so reordenado)", () => {
    const baralho = carregarBaralho();
    const embaralhado = embaralhar(baralho);

    expect(embaralhado).toHaveLength(baralho.length);
    expect(new Set(embaralhado.map((carta) => carta.id))).toEqual(new Set(baralho.map((carta) => carta.id)));
  });

  it("nao muta o array recebido", () => {
    const baralho = carregarBaralho();
    const idsOriginaisAntes = baralho.map((carta) => carta.id);

    embaralhar(baralho);

    expect(baralho.map((carta) => carta.id)).toEqual(idsOriginaisAntes);
  });
});

describe("baralho -- distribuir (AD-6)", () => {
  it("com 2 jogadores, divide exato: 16 Cartas cada, nenhuma descartada", () => {
    const baralho = carregarBaralho();
    const montes = distribuir(baralho, 2);

    expect(montes).toHaveLength(2);
    expect(montes[0]).toHaveLength(16);
    expect(montes[1]).toHaveLength(16);
    expect(montes[0].length + montes[1].length).toBe(32);
  });

  it("com 3 jogadores, sobra 2 Cartas: 10 cada, 2 descartadas (unico caso com sobra na faixa 2-4)", () => {
    const baralho = carregarBaralho();
    const montes = distribuir(baralho, 3);

    expect(montes).toHaveLength(3);
    for (const monte of montes) {
      expect(monte).toHaveLength(10);
    }
    const totalDistribuido = montes.reduce((soma, monte) => soma + monte.length, 0);
    expect(totalDistribuido).toBe(30); // 32 - 2 descartadas
  });

  it("com 4 jogadores, divide exato: 8 Cartas cada, nenhuma descartada", () => {
    const baralho = carregarBaralho();
    const montes = distribuir(baralho, 4);

    expect(montes).toHaveLength(4);
    for (const monte of montes) {
      expect(monte).toHaveLength(8);
    }
  });

  it("nunca distribui a mesma Carta pra dois Jogadores (sem duplicata entre Montes)", () => {
    const baralho = carregarBaralho();
    const montes = distribuir(baralho, 3);
    const idsDistribuidos = montes.flat().map((carta) => carta.id);

    expect(new Set(idsDistribuidos).size).toBe(idsDistribuidos.length);
  });
});
