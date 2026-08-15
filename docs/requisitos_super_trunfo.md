# Documento de Requisitos do Sistema: Jogo Super Trunfo Web

## 1. Visão Geral do Sistema
O sistema consiste em uma plataforma web que replica as regras tradicionais do jogo de cartas **Super Trunfo**, permitindo partidas multiplayer com baralhos estruturados e dinâmicas automatizadas baseadas em atributos.

## 2. Requisitos Funcionais (RF)

### RF01 - Estrutura e Inicialização do Baralho
* **RF01.1**: O sistema deve instanciar um baralho com exatamente **32 cartas jogáveis**.
* **RF01.2**: Cada carta deve possuir uma identificação única combinando um grupo numérico (de 1 a 8) e uma letra (A, B, C ou D). Exemplo: `1A`, `1B`, ..., `8D`.
* **RF01.3**: O sistema deve categorizar as cartas em 8 grupos de 4 cartas cada para fins de organização temática (ex: Grupo 1 = Esportivos, Grupo 2 = Picapes).
* **RF01.4**: Cada carta deve conter um conjunto fixo de atributos numéricos (ex: Velocidade Maxima (km/h),Potencia (CV),Potencia (HP),RPM Maximo,Cilindrada (cm3),Aceleracao 0-100 km/h (s),Qtd Cilindros).
* **RF01.5**: O sistema deve definir **uma única carta** do baralho com a flag especial `Super Trunfo`.
* **RF01.6**: O sistema deve usar modelos de carros onde serão Carros de determinados países

### RF02 - Gerenciamento de Jogadores e Partida
* **RF02.1**: O sistema deve suportar partidas de **2 a 4 jogadores** sendo 1 usuário e 3 Inteligência artificial (ou alguma forma que o computador tome decisões) caso apenas 1 se conecte.
* **RF02.2**: O sistema deve embaralhar as cartas aleatoriamente antes do início.
* **RF02.3**: O sistema deve distribuir as 32 cartas igualmente entre os jogadores. Caso a divisão não seja exata (ex: 3 jogadores), as cartas restantes devem ser descartadas ou distribuídas sob regra de sobra pré-definida.
* **RF02.4**: Cada jogador deve possuir um monte privado em formato de **fila (FIFO)**, onde apenas a carta do topo fica visível e disponível para ação.

### RF03 - Dinâmica da Rodada (Game Loop)
* **RF03.1**: O sistema deve determinar um jogador inicial para abrir a rodada.
* **RF03.2**: O jogador da vez deve selecionar um dos atributos numéricos da sua carta do topo.
* **RF03.3**: Após a seleção, o sistema deve revelar simultaneamente o valor desse mesmo atributo nas cartas do topo de todos os outros jogadores ativos.
* **RF03.4**: O sistema deve comparar os valores e declarar como vencedor o jogador com o **maior valor** (ou menor valor, caso o atributo seja inversamente proporcional, como 'Aceleracao 0-100 km/h (s)').
* **RF03.5**: O vencedor da rodada deve coletar todas as cartas jogadas e inseri-las no **final (fundo) do seu monte**.
* **RF03.6**: O vencedor da rodada atual ganha o direito de escolher o atributo na rodada seguinte.

### RF04 - Regra Especial: Carta Super Trunfo
* **RF04.1**: Se um jogador acionar a carta com a flag `Super Trunfo`, o sistema deve pular a comparação de atributos e conceder a vitória automática da rodada a este jogador, **exceto** se o RF04.2 for acionado.
* **RF04.2**: Se a carta `Super Trunfo` for jogada na mesma rodada em que **qualquer oponente** possuir uma carta cuja identificação termine com a **letra A** (ex: 1A, 5A), a regra de vitória automática é anulada.
* **RF04.3**: No cenário do RF04.2, o jogador com a carta de **letra A** é declarado o vencedor imediato da rodada, coletando o Super Trunfo e as demais cartas.

### RF05 - Resolução de Empates (O Funil)
* **RF05.1**: Se houver empate no maior valor do atributo selecionado, o sistema deve mover todas as cartas da rodada atual para um container temporário na mesa ("cartas presas").
* **RF05.2**: O jogador que escolheu o atributo inicial mantém o direito de escolher um **novo atributo** a partir da sua próxima carta do topo.
* **RF05.3**: O vencedor desta nova rodada de desempate coleta a sua nova carta, as novas cartas dos adversários e todas as cartas que estavam presas no container temporário.

### RF06 - Fim de Jogo e Eliminação
* **RF06.1**: O sistema deve eliminar do jogo o participante cujo monte de cartas chegue a zero.
* **RF06.2**: O sistema deve encerrar a partida e declarar vitória quando um único jogador centralizar todas as **32 cartas** do baralho.

---

## 3. Requisitos Não-Funcionais (RNF)

* **RNF01 - Desempenho**: As transições de rodadas, comparações de valores e animações de cartas não devem exceder 1.5 segundos de processamento no servidor.
* **RNF02 - Escalabilidade**: O backend deve suportar conexões WebSocket simultâneas para manter o estado do jogo em tempo real entre múltiplos jogadores.
* **RNF03 - Arquitetura de Dados**: O estado do monte de cada jogador deve ser protegido, garantindo que nenhum cliente consiga inspecionar as cartas do fundo do monte via console/API antes da hora (anti-cheat).
* **RNF04 - Responsividade**: A interface web deve ser adaptável para funcionar perfeitamente em dispositivos móveis e desktops.
