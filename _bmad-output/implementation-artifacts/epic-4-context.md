# Epic 4 Context: FAQ de Regras

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Qualquer jogador precisa conseguir relembrar as regras completas do Super Trunfo — incluindo os casos especiais que geram dúvida na mesa física, como a exceção da carta letra "A" contra o Super Trunfo e o funcionamento do Funil de desempate — sem precisar perguntar para outra pessoa nem parar uma Partida em andamento. Este épico entrega essa referência como uma superfície de FAQ estática, acessível só a partir da Tela Inicial (antes de criar ou entrar numa sala), e propositalmente ausente de qualquer tela da Mesa de Jogo — a Mesa não ganha tutorial embutido; a consulta às regras é sempre uma escolha opcional feita fora da Partida.

## Stories

- Story 4.1: FAQ de Regras

## Requirements & Constraints

- A FAQ deve ser alcançável a partir da Tela Inicial/lobby sem exigir criação ou entrada numa Sala, e deve permitir voltar à Tela Inicial a qualquer momento.
- A FAQ nunca aparece em nenhuma superfície da Mesa de Jogo (Partida em andamento) — isso é um requisito testável, não só uma preferência de design.
- O conteúdo deve cobrir pelo menos: estrutura do Baralho, o game loop (escolha de atributo → revelação → comparação → coleta), a Carta Super Trunfo e sua exceção (carta letra "A"), o Funil de desempate, e o fim de jogo/eliminação.
- Responsividade mobile-first se aplica (a FAQ roda nos mesmos dispositivos que o resto do app, sem breakpoint específico fixado).
- Piso de acessibilidade do produto se aplica aqui também: foco visível ao navegar por Tab, nenhuma informação carregada só por cor, contraste sempre de tinta escura sobre superfície clara.
- Microcópia em português direto, tom caloroso mas não infantilizado, usando os termos de domínio do Glossário verbatim (Baralho, Rodada, Atributo, Monte, Super Trunfo, Funil) — sem jargão técnico exposto ao jogador.
- Gap conhecido e explicitamente não bloqueante: o conteúdo real das perguntas e respostas (a redação final) ainda não foi escrito nas rodadas de planejamento — é tratado como pendência de conteúdo, não de UX/arquitetura. O mockup de referência traz um exemplo de tom e estrutura, não o texto final.

## Technical Decisions

- Epic inteiramente frontend: `frontend/src/screens/FAQ` (com componente correspondente em `frontend/src/components/`). Conteúdo estático, sem estado de servidor, sem mensagem de Room, sem envolvimento do Colyseus.
- Nenhuma decisão de arquitetura (AD-1 a AD-12) rege este épico além do fato de ele não precisar de nenhuma — é UI pura, versionada junto com o build estático do frontend.
- Sem dependência de conexão WebSocket ativa: a FAQ deve funcionar mesmo fora de qualquer sessão de sala.

## UX & Interaction Patterns

- Componente FAQ: lista de perguntas expansíveis em formato accordion (pergunta clicável revela a resposta). Acento amarelo usado só como detalhe pontual (ex.: filete lateral, ícone de expandir/recolher) — nunca como fundo de bloco de texto longo, para não cansar a leitura.
- Superfície somente leitura — nenhuma ação de jogo parte daqui. Link "Voltar" sempre visível/disponível para a Tela Inicial.
- Tipograficamente, é a superfície mais "calma" do app: texto de interface usa o estilo de corpo padrão, sem os efeitos decorativos ("letra bolha", halo-label) usados no wordmark e em badges — esses efeitos nunca aparecem em texto corrido, parágrafo ou na FAQ.
- Fundo em `card-paper` (branco limpo), consistente com outras superfícies onde dado precisa ser lido rápido (ex.: Lista da Sala de Espera).
- Arquitetura de informação: a FAQ é a única ramificação fora do fluxo linear principal (Criar/Entrar → Espera → Mesa → Fim) — não tem rota própria dentro do fluxo de jogo, só existe pendurada na Tela Inicial e sempre retorna a ela.
- Decisão de produto explícita: isto não é um tutorial empurrado durante a Partida (rejeitado deliberadamente, dado o público de família/amigos que já conhece o jogo físico) — é consulta opcional, só na Tela Inicial.
- Mockup de referência: `_bmad-output/planning-artifacts/ux-designs/ux-SuperTrunfoWeb-2026-08-15/mockups/key-faq.html` — mostra o padrão visual (header amarelo com "voltar", accordion com item inicial aberto, indicador de seta, borda de acento no primeiro item) e um exemplo de tom para as respostas (curtas, diretas, cobrindo mecânica de rodada, Super Trunfo, empate/Funil e fim de partida). Não cobre ainda uma pergunta dedicada à estrutura do Baralho, que a Story 4.1 precisa incluir.

## Cross-Story Dependencies

Nenhuma. É um épico de história única, sem estado compartilhado com Sala/Partida — a FAQ deve funcionar de forma independente de qualquer sessão de sala ou progresso de Partida (Épicos 1-3).
