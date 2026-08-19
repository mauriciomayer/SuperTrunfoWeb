import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Carta } from "../schema/Carta.ts";

const TOTAL_CARTAS_ESPERADO = 32;

/**
 * Resolve o caminho padrao de `docs/carros_specs.csv`, relativo a este
 * arquivo -- tres niveis acima (`backend/src/game` em dev, `backend/dist/game`
 * depois do build) chegam na raiz do repo, onde o CSV mora (Code Map da
 * Story 2.1: fonte de dados ja existe, nunca copiar pro backend). Mesmo
 * truque de `servirFrontendEstatico.ts` (Story 1.5), so que um nivel mais
 * fundo (`src/game/` em vez de `src/`).
 */
function resolverCsvPadrao(): string {
  const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(diretorioAtual, "../../../docs/carros_specs.csv");
}

/**
 * Parse manual de uma linha CSV simples -- nenhum campo de
 * `carros_specs.csv` contem virgula (nem o `Modelo`, que nem chega a ser
 * usado aqui), entao um `split(",")` direto e suficiente. Boundaries da
 * Story 2.1 proibe trazer lib nova de parsing so pra isso.
 */
function parsearLinha(linha: string): string[] {
  return linha.split(",");
}

/**
 * carregarBaralho -- le e parseia `docs/carros_specs.csv` num Baralho de
 * exatamente 32 Cartas (RF01.1/RF01.4), sem duplicar esses dados em codigo
 * (Boundaries). `caminhoCsv` e injetavel so pro teste conseguir apontar
 * pra um fixture isolado sem depender do CSV real do repo.
 *
 * Lanca erro se o arquivo nao tiver exatamente 32 linhas de dados -- falha
 * cedo e alto em vez de deixar uma Partida comecar com um Baralho invalido
 * (nunca aconteceria com o CSV real do repo intacto, mas protege contra
 * edicao acidental do arquivo).
 */
export function carregarBaralho(caminhoCsv: string = resolverCsvPadrao()): Carta[] {
  const conteudo = readFileSync(caminhoCsv, "utf-8");
  const linhas = conteudo.trim().split(/\r?\n/);
  const [linhaCabecalho, ...linhasDados] = linhas;
  const colunas = parsearLinha(linhaCabecalho);

  const linhasComConteudo = linhasDados.filter((linha) => linha.trim().length > 0);

  const cartas = linhasComConteudo.map((linha, indice) => {
    const valores = parsearLinha(linha);

    // Uma linha desalinhada (coluna a mais/a menos, ex: edicao futura do
    // CSV que corta ou acrescenta uma coluna sem querer) preencheria
    // campos com `undefined`/`NaN` em silencio -- falha cedo e alto em vez
    // disso. `+2` no numero da linha: +1 pro cabecalho (linha 1), +1
    // porque `indice` e 0-based.
    if (valores.length !== colunas.length) {
      throw new Error(
        `Baralho invalido: linha ${indice + 2} de ${caminhoCsv} tem ${valores.length} colunas, esperado ${colunas.length} (mesma contagem do cabecalho)`,
      );
    }

    const registro: Record<string, string> = {};
    colunas.forEach((coluna, indiceColuna) => {
      registro[coluna] = valores[indiceColuna];
    });

    const carta = new Carta();
    carta.id = registro["ID"];
    carta.grupo = Number(registro["Grupo"]);
    carta.letra = registro["Letra"];
    carta.superTrunfo = registro["SuperTrunfo"]?.toLowerCase() === "true";
    carta.imagem = registro["Imagem"];
    carta.pais = registro["Pais"];
    carta.velocidadeMaxima = Number(registro["Velocidade Maxima (km/h)"]);
    carta.potenciaCv = Number(registro["Potencia (CV)"]);
    carta.potenciaHp = Number(registro["Potencia (HP)"]);
    carta.rpmMaximo = Number(registro["RPM Maximo"]);
    carta.cilindrada = Number(registro["Cilindrada (cm3)"]);
    carta.aceleracao = Number(registro["Aceleracao 0-100 km/h (s)"]);
    carta.qtdCilindros = Number(registro["Qtd Cilindros"]);
    return carta;
  });

  if (cartas.length !== TOTAL_CARTAS_ESPERADO) {
    throw new Error(
      `Baralho invalido: esperado ${TOTAL_CARTAS_ESPERADO} Cartas em ${caminhoCsv}, encontrado ${cartas.length}`,
    );
  }

  // RF01.5: exatamente 1 Carta com a flag Super Trunfo -- mesma filosofia
  // "falha cedo e alto" da contagem de 32 Cartas acima, protegendo contra
  // uma edicao futura do CSV que zere ou duplique a flag em silencio.
  const totalSuperTrunfo = cartas.filter((carta) => carta.superTrunfo).length;
  if (totalSuperTrunfo !== 1) {
    throw new Error(
      `Baralho invalido: esperada exatamente 1 Carta com a flag Super Trunfo em ${caminhoCsv}, encontrado ${totalSuperTrunfo}`,
    );
  }

  return cartas;
}

/**
 * embaralhar -- Fisher-Yates (Boundaries: aleatorio antes de cada
 * Partida). Nao muta o array recebido -- devolve uma copia embaralhada,
 * pra `carregarBaralho()` (ou qualquer outro chamador) nunca ter o
 * proprio array reordenado por baixo dos panos.
 */
export function embaralhar(cartas: Carta[]): Carta[] {
  const copia = [...cartas];
  for (let indice = copia.length - 1; indice > 0; indice--) {
    const indiceAleatorio = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[indiceAleatorio]] = [copia[indiceAleatorio], copia[indice]];
  }
  return copia;
}

/**
 * distribuir -- regra de sobra AD-6: `cartasPorJogador = Math.floor(total / n)`,
 * `descartadas = total % n`; as descartadas nunca entram em nenhum Monte.
 *
 * Distribui em rodizio (round-robin) a partir do Baralho ja embaralhado --
 * cada Jogador recebe as Cartas na ordem em que "caem" pra ele, entao o
 * Monte resultante ja nasce na convencao FIFO (indice 0 = primeira Carta
 * recebida = topo, ver Design Notes do spec).
 *
 * Funcao pura e agnostica de Jogador -- devolve um array de N Montes na
 * mesma ordem em que o chamador quiser mapear pros N Jogadores (index
 * alinhado); quem decide "Monte i pertence a qual Jogador" e o chamador
 * (`PartidaRoom`), nao esta funcao.
 */
export function distribuir(cartas: Carta[], totalJogadores: number): Carta[][] {
  const cartasPorJogador = Math.floor(cartas.length / totalJogadores);
  const montes: Carta[][] = Array.from({ length: totalJogadores }, () => []);

  const totalDistribuido = cartasPorJogador * totalJogadores;
  for (let indice = 0; indice < totalDistribuido; indice++) {
    montes[indice % totalJogadores].push(cartas[indice]);
  }

  return montes;
}
