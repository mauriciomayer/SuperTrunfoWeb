# Epic 6 Context: Ritmo e Espaço na Mesa

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Com o Épico 5 já em produção e a família jogando de verdade, este épico resolve três ajustes de ritmo e espaço na Mesa de Jogo que só apareceram no uso real: a IA passa a fazer uma pausa perceptível antes de jogar, em vez de decidir instantaneamente; a Mesa de Jogo em desktop passa a ocupar a tela inteira sem exigir rolagem, com a Carta própria e os oponentes em colunas separadas; e o Chip de Resultado desaparece sozinho depois de alguns segundos, em vez de ficar preso na tela até a próxima Rodada resolver.

## Stories

- Story 6.1: Pausa de "IA Pensando"
- Story 6.2: Mesa de Jogo em Tela Cheia no Desktop
- Story 6.3: Chip de Resultado Desaparece Automaticamente

## Requirements & Constraints

- A pausa da IA deve ter a mesma duração da pausa de revelação já existente (2,5s), e durante essa pausa os demais jogadores devem ver que é a vez da IA sem a jogada já resolvida — não é mais suficiente atrasar só a exibição no cliente.
- O layout desktop de duas colunas (Carta própria à esquerda, oponentes em grade 2x2 à direita) deve caber inteiro na viewport sem rolagem, numa tela larga o suficiente; o layout empilhado mobile-first deve continuar exatamente como está em telas estreitas, sem alteração.
- O Chip de Resultado deve desaparecer sozinho após alguns segundos sem um novo resultado, e nunca continuar visível durante a Rodada seguinte mostrando informação desatualizada.
- Desempenho de servidor (transições de Rodada, comparações, animações) não deve exceder 1,5s de processamento (NFR-1) — a pausa da IA introduzida aqui é deliberada e visível, não um atraso de processamento.
- Responsividade mobile + desktop continua obrigatória (NFR-4); este é o primeiro épico do projeto a fixar um breakpoint desktop formal.

## Technical Decisions

- **Revisão de AD-4 (pausa da IA passa a ser server-side).** AD-4 original proibia explicitamente qualquer `setTimeout`/delay no servidor entre a Room entrar em `AguardandoSelecao` para um assento IA e a aplicação da decisão — a regra dizia que ritmo visual deveria ser "só do lado do cliente". Na prática, `PartidaRoom.ts` aplica a jogada da IA na mesma transição síncrona que a torna Jogador da vez, sem nenhum `await`/yield entre as duas — então o cliente nunca observa um estado intermediário "é a vez da IA, ainda não jogou", só recebe o resultado já aplicado. Story 6.1 exige que o SERVIDOR agora adie o despacho da jogada da IA usando o mesmo padrão de timer já usado para a pausa de revelação (`this.clock.setTimeout`, mesma duração de `DURACAO_REVELACAO_MS` — 2,5s). O restante de AD-4 não muda: a decisão em si (`decidirAtributoIA`) continua síncrona, in-process e determinística; só o momento do despacho passa a ser adiado deliberadamente.
- **Máquina de estados (AD-5)** permanece a fonte de verdade do game loop (`AguardandoJogadores → AguardandoSelecao → Revelando → ResolvendoRodada → (Funil | AguardandoSelecao | FimDePartida)`, mais `SuperTrunfoAcionado`). A pausa da IA introduzida aqui deve respeitar essa máquina — nenhuma outra mensagem deve ser processada durante a janela de espera, para não reabrir a janela de mensagens concorrentes que AD-5 fecha (ex: duas jogadas na mesma Rodada).
- **Revisão de UX-DR14 (primeiro breakpoint desktop fixado).** O projeto inteiro é hoje mobile-first sem nenhuma `@media` query no `frontend/`; a Arquitetura deixava o ponto de corte exato como decisão de implementação. Story 6.2 fixa esse breakpoint pela primeira vez, introduzindo o layout de duas colunas (Carta própria à esquerda, oponentes em grade 2x2 à direita) só acima dele; abaixo, o layout empilhado mobile-first permanece inalterado.
- **Dívida técnica já registrada (`ultimoResultado` nunca é limpo).** Desde a História 5.1, o campo de estado que alimenta o Chip de Resultado só é limpo no branch de empate — no branch de vitória normal ele nunca é resetado, e por isso o Chip só "some" hoje quando a próxima Rodada resolve e sobrescreve o valor. Story 6.3 resolve isso com um timer client-side que esconde o Chip depois de alguns segundos, sem exigir mudança de backend nesse campo.

## UX & Interaction Patterns

- Chip de Resultado: selo estrelado/starburst (não pílula genérica), com borda semântica (verde/âmbar/vermelho) e texto sempre presente ("Você venceu", "Empate — Funil", "Eliminado") — a cor nunca é o único portador de significado. O comportamento de desaparecimento automático (Story 6.3) não deve remover esse texto antes da leitura ser possível.
- Mesa de Jogo desktop (Story 6.2): duas colunas — Carta própria à esquerda, oponentes em grade 2x2 à direita — preenchendo a tela sem rolagem. Mobile mantém o layout empilhado atual (Carta própria embaixo, oponentes em cima, menores) sem nenhuma alteração.
- Pausa de "IA pensando" (Story 6.1): mesma duração visual da pausa de revelação (2,5s) já usada em outras partes da Mesa, mantendo consistência de ritmo entre os dois momentos de espera que o jogador já conhece.

## Cross-Story Dependencies

- Story 6.1 depende do padrão de timer server-side já existente para a pausa de revelação (`DURACAO_REVELACAO_MS` / `this.clock.setTimeout` em `PartidaRoom.ts`) e reutiliza esse mesmo mecanismo — não introduz um novo padrão de timing.
- Story 6.3 se conecta a uma lacuna deixada pela História 5.1 (Épico 5): o Chip de Resultado já foi tornado sempre visível sem rolagem naquela história, mas o bug de `ultimoResultado` nunca limpo no branch de vitória normal ficou como dívida técnica até esta história.
- Stories 6.1 e 6.2 são independentes entre si (uma mexe em timing de servidor, a outra em layout de cliente) e podem ser feitas em qualquer ordem.
