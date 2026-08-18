import { useEffect, useRef } from "react";
import "./FAQ.css";

interface FAQProps {
  onVoltar: () => void;
}

interface PerguntaFAQ {
  pergunta: string;
  resposta: string;
}

/**
 * Conteudo estatico da FAQ (Story 4.1) -- cobre as 5 areas da Matrix
 * (Boundaries "Always"/epic-4-context.md > Requirements): estrutura do
 * Baralho, o game loop, a Carta Super Trunfo + excecao da letra "A", o
 * Funil de desempate, e o fim de jogo/eliminacao. Redacao alinhada com as
 * regras REALMENTE implementadas (`atributos.ts`/`superTrunfo.ts`/
 * `comparacao.ts`/`PartidaRoom.ts`), nao a simplificacao do mockup de
 * referencia (Design Notes do spec: a excecao do Super Trunfo NAO e
 * "qualquer adversario com carta A" solto, e sim uma ordem circular a
 * partir do proximo Jogador).
 */
const PERGUNTAS: PerguntaFAQ[] = [
  {
    pergunta: "Como é o Baralho?",
    resposta:
      "O Baralho tem 32 Cartas, cada uma com 7 Atributos numéricos comparáveis: Velocidade Máxima, Potência (CV), Potência (HP), RPM Máximo, Cilindrada, Aceleração 0-100 km/h e Quantidade de Cilindros. Em 6 desses Atributos, quem tem o maior valor vence a Rodada; só na Aceleração 0-100 km/h é ao contrário — vence quem tem o menor valor (o carro que acelera mais rápido).",
  },
  {
    pergunta: "Como funciona uma Rodada?",
    resposta:
      "O Jogador da vez escolhe um Atributo a partir da Carta no topo do próprio Monte. As Cartas de todos os Jogadores ainda ativos revelam ao mesmo tempo, o valor desse Atributo é comparado entre elas, e quem tiver o melhor valor vence a Rodada e leva todas as Cartas reveladas para o fundo do próprio Monte — inclusive as dos adversários.",
  },
  {
    pergunta: 'O que é a Carta Super Trunfo, e como funciona a exceção da letra "A"?',
    resposta:
      'A Carta Super Trunfo vence a Rodada automaticamente, sem comparar nenhum Atributo — exceto se um adversário conseguir anulá-la com uma Carta letra "A". Essa checagem segue uma ordem fixa: começa no próximo Jogador depois de quem jogou o Super Trunfo (na ordem em que os Jogadores entraram na Sala) e continua Jogador a Jogador; a primeira Carta letra "A" encontrada nesse percurso vence a Rodada no lugar do Super Trunfo. Se nenhum Jogador no caminho tiver uma Carta "A", o Super Trunfo vence sem oposição.',
  },
  {
    pergunta: "O que acontece em caso de empate? Como funciona o Funil?",
    resposta:
      "Quando dois ou mais Jogadores empatam no melhor valor do Atributo escolhido, ninguém vence a Rodada — todas as Cartas reveladas ficam retidas no Funil. O mesmo Jogador que abriu a Rodada escolhe um novo Atributo, agora com a Carta seguinte do próprio Monte, e a disputa se repete entre todos os Jogadores ainda ativos; se empatar de novo, mais Cartas se somam ao Funil. Assim que uma dessas Rodadas de desempate terminar sem empate, o vencedor leva tudo: as Cartas dessa Rodada final e todas as que estavam acumuladas no Funil.",
  },
  {
    pergunta: "Como a Partida termina?",
    resposta:
      "Um Jogador é eliminado assim que o próprio Monte fica sem Cartas, e sai das Rodadas seguintes. A Partida termina quando resta um único Jogador ativo — ele reúne o Baralho inteiro (ou quase: em Partidas com 3 Jogadores, 2 Cartas ficam de fora logo na distribuição inicial e nunca entram em disputa).",
  },
];

/**
 * FAQ (Story 4.1) -- unica ramificacao fora do fluxo linear principal
 * (epic-4-context.md > UX & Interaction Patterns), so alcancavel a partir
 * da Tela Inicial (`CriarSala`) e sempre volta pra ela. Conteudo 100%
 * estatico -- sem `room`/`room.state`, sem Colyseus.
 *
 * Accordion nativo (`<details>/<summary>`) em vez de um componente custom
 * com `useState`/JS: foco/toggle de teclado (Enter/Espaco) e foco visivel
 * vem de graca do navegador, batendo com o piso de acessibilidade do
 * epico sem codigo extra (Design Notes do spec).
 *
 * Gerenciamento de foco (achado do code review): trocar de tela sem mover
 * o foco deixa um usuario de teclado/leitor de tela perdido (o navegador
 * reseta pro `<body>`). O `<h1>` recebe `tabIndex={-1}` (fora da ordem de
 * Tab normal, so alcancavel via `.focus()` programatico) e ganha foco no
 * `useEffect` de montagem -- dispara toda vez que `FAQ` monta, ja que
 * `App.tsx` monta/desmonta este componente inteiro a cada toggle. O
 * retorno de foco pro botao "Como funciona?" ao voltar e responsabilidade
 * de `CriarSala.tsx` (que nunca desmonta, ver `App.tsx`), nao daqui.
 */
export function FAQ({ onVoltar }: FAQProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="faq">
      <header className="faq__header">
        <button type="button" className="faq__voltar" onClick={onVoltar} aria-label="Voltar">
          ←
        </button>
        <h1 ref={headingRef} tabIndex={-1}>
          FAQ — Regras do Jogo
        </h1>
      </header>

      <div className="faq__lista">
        {PERGUNTAS.map((item, indice) => (
          <details
            key={item.pergunta}
            className={indice === 0 ? "faq__item faq__item--accent" : "faq__item"}
            open={indice === 0}
          >
            <summary>{item.pergunta}</summary>
            <p className="faq__resposta">{item.resposta}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
