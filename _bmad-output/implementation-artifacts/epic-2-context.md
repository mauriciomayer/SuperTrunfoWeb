# Epic 2 Context: Partida Completa

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Este épico entrega o game loop inteiro do Super Trunfo: a partir do intent `iniciarPartida` (já disparado pelo botão "Iniciar" da Sala de Espera desde a História 1.4, mas sem handler no backend ainda), o sistema instancia o Baralho de 32 Cartas, embaralha e distribui entre os Jogadores, e conduz Rodada após Rodada — seleção de Atributo, revelação simultânea, comparação, coleta de Cartas — até um único Jogador reunir o Baralho inteiro. Cobre também as duas regras especiais do jogo físico: a Carta Super Trunfo (com sua exceção da Carta letra "A") e o Funil de desempate. É este épico que faz a Partida ser, de fato, jogável do início ao fim — sem juiz humano e sem nenhuma Carta vazando para quem não deveria vê-la.

## Stories

- Story 2.1: Baralho, Distribuição e Minha Carta
- Story 2.2: Seleção de Atributo e Revelação
- Story 2.3: Comparação, Vencedor e Próxima Rodada
- Story 2.4: Carta Super Trunfo
- Story 2.5: Funil (Desempate)
- Story 2.6: Fim de Jogo e Eliminação

## Requirements & Constraints

- Todo Baralho tem exatamente 32 Cartas distintas, cada uma com ID único `{grupo}{letra}` (Grupo 1-8 + Letra A-D), um conjunto fixo de Atributos numéricos, e organizadas em 8 Grupos de 4. Exatamente uma Carta carrega a flag Super Trunfo — a `2A` (Ferrari 812 Superfast), já marcada em `docs/carros_specs.csv`; essa atribuição é conteúdo, não algo a decidir em código.
- As Cartas são embaralhadas aleatoriamente antes de cada Partida (ordem não determinística entre Partidas) e distribuídas igualmente; a divisão exata só falha com 3 Jogadores dentro da faixa suportada (2-4).
- Cada Jogador tem um Monte privado FIFO — só a Carta do topo é visível/jogável, tanto pela própria interface quanto por qualquer inspeção externa (console/API). Um Jogador nunca vê o Monte completo, nem o próprio nem o alheio.
- A seleção de Atributo só é aceita do Jogador da vez, e só entre os Atributos presentes na própria Carta do topo. A revelação subsequente é sempre simultânea para todos os Jogadores ativos — ninguém vê o valor do Atributo do oponente antes desse instante.
- Comparação: maior valor vence, exceto Aceleração 0-100 km/h, onde vence o menor — esse é o único Atributo inverso confirmado no conjunto atual do Baralho.
- O vencedor da Rodada coleta todas as Cartas jogadas para o fundo (não o topo) do próprio Monte, e ganha o direito de escolher o Atributo da Rodada seguinte.
- Super Trunfo: jogar essa Carta pula a comparação e vence automaticamente, exceto se algum oponente tiver Carta terminada em "A" na mesma Rodada — nesse caso o portador da "A" vence, coletando o Super Trunfo e as demais Cartas. Com múltiplas Cartas "A" entre oponentes, o desempate é por ordem de entrada na sala.
- Empate no maior valor manda todas as Cartas da Rodada para o Funil; quem abriu a Rodada empatada escolhe o próximo Atributo (não passa a vez); o vencedor do desempate leva a nova Rodada inteira mais tudo que estava retido no Funil.
- Um Jogador é eliminado assim que o Monte chega a zero Cartas — sai da rotação de turno e de revelação, mas os demais continuam vendo a Partida normalmente. A Partida termina quando um único Jogador reúne as 32 Cartas; nenhuma nova Rodada começa depois disso.
- Teto de desempenho: nenhuma transição de Rodada, comparação de valores ou animação de Carta deve passar de 1,5s de processamento no servidor.
- Anti-cheat: o Monte de cada Jogador (além da Carta do topo) precisa estar protegido no nível do servidor, não só escondido na UI — nenhum cliente consegue inspecionar Cartas fora de hora via console/API.
- A Mesa de Jogo (todas as telas deste épico) precisa funcionar bem em mobile e desktop.

## Technical Decisions

- **Máquina de estados explícita** governa todo o game loop: `AguardandoJogadores → AguardandoSelecao → Revelando → ResolvendoRodada → (AguardandoSelecao | Funil | FimDePartida)`, mais `SuperTrunfoAcionado` como desvio a partir de `AguardandoSelecao`. Cada transição é síncrona e local (sem I/O externo) para manter a margem do teto de 1,5s sem esforço extra. Toda transição passa por `backend/src/game/`.
- **`AguardandoSelecao` tem três entradas com semânticas de turno distintas** — implementar como três ações de entrada separadas, nunca um `onEnter` genérico: (1) vindo de `ResolvendoRodada` sem empate, `jogadorDaVez` muda para o vencedor; (2) vindo de `Funil`, `jogadorDaVez` não muda — permanece quem abriu a Rodada empatada; (3) self-loop de eliminação, `jogadorDaVez` não muda exceto para pular o Jogador recém-eliminado na ordem de turno.
- **Jogador Inicial = sempre o host**, confirmado — sem sorteio.
- **Contrato de mensagem `jogarCarta`** `{ atributo?: string }`, aceito só em `AguardandoSelecao` e só do Jogador da vez: joga a Carta do topo do Monte dele. Se a Carta não é o Super Trunfo, `atributo` é obrigatório e a transição vai para `Revelando`. Se é o Super Trunfo, `atributo` é ignorado e o servidor aplica a exceção da letra "A" direto, indo para `ResolvendoRodada`. Um único intent cobre os dois casos — o servidor decide o que ele desencadeia, olhando a flag da Carta, nunca o cliente.
- **`iniciarPartida`** `{}`, só do host, só em `AguardandoJogadores`: fecha a Sala de Espera, embaralha e distribui o Baralho, define o Jogador Inicial, transiciona para `AguardandoSelecao`. Este é o primeiro handler `onMessage("iniciarPartida", ...)` da `PartidaRoom` — o frontend já envia esse intent desde a História 1.4, mas o backend ainda não tem handler algum para ele; a `EstadoPartida`/`Jogador` atuais só têm `jogadores`, `totalJogadoresDeclarado`, `totalIADeclarado` — Carta, Monte, Rodada e Funil são schema novo deste épico.
- **Visibilidade filtrada no servidor, nunca só na UI (anti-cheat real).** Existem duas representações de estado: um `EstadoPartida` canônico não filtrado (usado por toda lógica de `backend/src/game/`) e uma view filtrada por cliente aplicada só na borda de serialização (Colyseus `StateView`/schema filtering). Fora de `Revelando`/`ResolvendoRodada`/`Funil`, um cliente só vê a contagem de Cartas do Monte de cada oponente, nunca conteúdo. Ao entrar em `Revelando`, a Carta do topo inteira (todos os Atributos, Grupo/Letra, flag Super Trunfo) de cada Jogador ativo fica visível para todos — não só o valor do Atributo selecionado.
- **Regra de sobra na distribuição:** `cartasPorJogador = Math.floor(32 / n)`, `descartadas = 32 % n`; as descartadas ficam fora da Partida inteira. Só `n=3` produz sobra na faixa suportada (10 por Jogador, 2 descartadas); `n=2` e `n=4` dividem exato.
- **Atributos inversos são dado, não `if` hardcoded:** cada Atributo carrega um campo `inverso: boolean` em `backend/src/game/atributos.ts`. Só "Aceleração 0-100 km/h (s)" é `inverso: true`; os outros 6 (Velocidade Máxima, Potência CV, Potência HP, RPM Máximo, Cilindrada, Qtd. Cilindros) são `inverso: false`.
- **Desempate de múltiplas Cartas letra "A":** vence quem estiver mais próximo, em ordem crescente e circular, do Jogador que acionou o Super Trunfo — na ordem de entrada na Room (join order, já rastreada nativamente pelo Colyseus).
- **Forma do schema:** `EstadoPartida.rodadaAtual` é `{ jogadorDaVez, atributoSelecionado?, cartasEmDisputa: Carta[] }`; `EstadoPartida.funil` é `{ cartasPresas: Carta[] }`, populado só durante o estado `Funil` e esvaziado na coleta. Ambos são objetos nested em `EstadoPartida`, não Schemas de topo separados.
- **Estrutura de pastas relevante:** `backend/src/game/` (comparação, Funil, Super Trunfo, `atributos.ts`) — regras puras, testáveis sem rede; `backend/src/schema/` (Carta, Monte, Jogador, `EstadoPartida` com filtros); `backend/src/rooms/PartidaRoom.ts` (dono da máquina de estados). Nenhuma dessas regras roda no frontend.
- **IA como Jogador**: a máquina de estados deste épico precisa aceitar que `jogadorDaVez` seja um assento controlado por IA (a decisão em si — `decidirAtributoIA` in-process, aplicada atomicamente — é do Épico 3; aqui basta não assumir que todo Jogador é humano).
- **Pirâmide de testes**, já montada na História 1.1, esperada como parte do "pronto" de cada história: unitário (Vitest) em `backend/src/game/` para toda função pura de regra (comparação, Funil, Super Trunfo, atributo inverso, regra de sobra); integração de Room (`@colyseus/testing`) para a `PartidaRoom` e sua máquina de estados; componente (Vitest + React Testing Library) por componente da Mesa; E2E (Playwright) para o fluxo completo. Unitário e integração de Room são prioridade — pegam bug de regra, o mais caro neste projeto.
- Nomes de domínio em português verbatim do Glossário (`Carta`, `Monte`, `Rodada`, `Funil`, `Baralho`, `Grupo`, `Atributo`); toda mutação de estado passa por handler de mensagem da Room, nunca mutação direta do schema fora de um handler.

## UX & Interaction Patterns

- **Carta (frente):** sem faixa de cabeçalho colorida nem nome do modelo; foto do carro ocupa ~58% da altura do card (placeholder "foto em breve" até fotos reais existirem), indo de borda a borda sem padding interno; badge de bandeira do país no canto superior esquerdo sobre a foto (nome do país só em texto alternativo/tooltip); badge circular Grupo/Letra no canto superior direito. Moldura vermelha grossa (3px); se for a Carta Super Trunfo, moldura dourada de 4px + selo estrelado "★ SUPER TRUNFO".
- **Carta (verso):** usada para as Cartas dos oponentes antes da revelação — fundo amarelo com grade fina e wordmark genérico centralizado; nenhuma informação identificável (nem Grupo/Letra, nem ID, nem foto, nem Atributo) antes da hora.
- **Linha de Atributo:** clicável só na vez do Jogador; clique único já revela e resolve a Rodada — sem confirmação intermediária. Estado selecionado com fundo laranja/texto escuro. Altura mínima de toque 44px.
- **Chip de Resultado:** selo estrelado/starburst (não pílula genérica), borda semântica grossa (verde vitória, âmbar empate, vermelho eliminação) e texto sempre presente ("Você venceu", "Empate — Funil", "Eliminado") — nunca só a cor.
- **Banner de Vitória:** usa o Chip de Resultado como base; na Rodada mostra vencedor + valor decisivo com Cartas "voando" para o Monte dele; na Partida, confete + nome do vencedor final. Vencedor identificado pelo nome do Jogador, nunca pelo nome do carro.
- **Funil:** cartão na área central da Mesa, fundo com grade sutil e borda tracejada âmbar.
- **Padrões de estado da Mesa:** Aguardando seleção (só o Jogador da vez vê Linhas de Atributo clicáveis; os demais veem "Aguardando [nome] escolher…"); Revelação (todas as Cartas da Rodada viram simultaneamente, Atributo selecionado destacado); Empate→Funil (Cartas movidas visualmente para o Funil, mensagem indica novo Atributo a escolher pelo mesmo Jogador); Super Trunfo acionado (vitória automática imediata sem revelação de Atributo, exceto quando uma Carta "A" de oponente é destacada como vencedora real); Jogador eliminado (some da rotação de vez, assento marcado com Chip de Resultado vermelho + texto "Eliminado"); Fim de Partida (substitui a Mesa de Jogo, oferece "Jogar novamente").
- Animações (viragem de Carta, Cartas voando para o Monte do vencedor, confete) respeitam `prefers-reduced-motion` — a versão sem movimento mostra o resultado final diretamente. Sem som.
- Nenhuma informação de resultado (vitória, empate, eliminação, identidade do Super Trunfo) depende só de cor.
- Mobile-first: a Mesa empilha verticalmente (Carta própria embaixo, Cartas dos oponentes menores em cima) como layout base; desktop escala para algo mais espacial.
- A Mesa de Jogo usa um fundo creme quente mais claro que o amarelo pleno da marca — mantém a identidade sem cansar a vista numa Partida de vários minutos de atenção sustentada.

## Cross-Story Dependencies

- Story 2.1 é a fundação de todo o épico: instancia o handler `iniciarPartida` (inexistente até aqui), o schema de Carta/Monte/Baralho, e a distribuição — todas as demais stories deste épico assumem que ela já rodou.
- Story 2.2 (seleção/revelação) depende do Monte e da Carta do topo entregues pela Story 2.1.
- Story 2.3 (comparação/vencedor/próxima Rodada) depende da revelação da Story 2.2; e o "próxima Rodada" que ela implementa é a mesma entrada 1 de `AguardandoSelecao` que a Story 2.5 usa de forma diferente (entrada 2, sem trocar o turno) — as duas stories devem tratar essas entradas como semânticas distintas, não uma generalização única.
- Story 2.4 (Super Trunfo) é um desvio a partir do mesmo ponto de entrada de `jogarCarta` que a Story 2.2 usa — mesma mensagem, ramificação decidida pela flag da Carta no servidor.
- Story 2.5 (Funil) só é alcançada a partir de um empate detectado pela lógica de comparação da Story 2.3.
- Story 2.6 (eliminação/fim de jogo) depende da coleta de Cartas implementada nas Stories 2.3, 2.4 e 2.5 — é o zero no Monte (ou as 32 cartas reunidas) resultante delas que dispara eliminação/fim.
- Este épico entrega a Carta, o Monte e o Jogador jogando de fato — mas a IA realmente decidindo um Atributo (`decidirAtributoIA`) e a substituição permanente por desconexão são do Épico 3; este épico só precisa deixar a máquina de estados agnóstica a se `jogadorDaVez` é humano ou IA. A FAQ de regras (Épico 4) é independente e não bloqueia nem é bloqueada por este épico.
