---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-SuperTrunfoWeb-2026-08-14/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-SuperTrunfoWeb-2026-08-15/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-SuperTrunfoWeb-2026-08-15/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-SuperTrunfoWeb-2026-08-15/EXPERIENCE.md'
---

# Super Trunfo Web - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Super Trunfo Web, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: O sistema instancia um Baralho com exatamente 32 Cartas jogáveis a cada nova Partida.
FR-2: Cada Carta possui identificação única (Grupo 1-8 + letra A-D) e um conjunto fixo de Atributos numéricos.
FR-3: O sistema define exatamente uma Carta do Baralho com a flag Super Trunfo.
FR-4: As Cartas são organizadas em 8 Grupos de 4 Cartas cada, por categoria/país.
FR-5: O sistema suporta Partidas de 2 a 4 Jogadores; host declara total de Jogadores e quantos são IA na criação da sala; vaga humana não preenchida até o início também vira IA.
FR-6: O sistema embaralha as 32 Cartas aleatoriamente antes do início de cada Partida.
FR-7: O sistema distribui as 32 Cartas igualmente entre os Jogadores; aplica regra de sobra pré-definida quando a divisão não é exata.
FR-8: Cada Jogador possui um Monte privado em formato de fila FIFO, com apenas a Carta do topo visível/jogável.
FR-9: O sistema determina um Jogador inicial para abrir a primeira Rodada de cada Partida.
FR-10: O Jogador da vez seleciona um dos Atributos numéricos da própria Carta do topo.
FR-11: Após a seleção, o sistema revela simultaneamente o valor do mesmo Atributo nas Cartas do topo de todos os outros Jogadores ativos.
FR-12: O sistema compara os valores revelados e declara vencedor o Jogador com o maior valor — ou o menor, quando o Atributo é inversamente proporcional.
FR-13: O vencedor da Rodada coleta todas as Cartas jogadas e as insere no fundo do próprio Monte.
FR-14: O vencedor da Rodada atual escolhe o Atributo da Rodada seguinte.
FR-15: Se um Jogador aciona a Carta Super Trunfo, o sistema pula a comparação de Atributos e concede vitória automática — exceto se FR-16 for acionado.
FR-16: Se a Carta Super Trunfo for jogada na mesma Rodada em que qualquer oponente possui uma Carta terminada em "A", a vitória automática é anulada.
FR-17: No cenário do FR-16, o Jogador com a Carta letra "A" é declarado vencedor imediato, coletando o Super Trunfo e as demais Cartas jogadas.
FR-18: Em caso de empate no maior valor do Atributo selecionado, o sistema move todas as Cartas da Rodada atual para o Funil.
FR-19: O Jogador que escolheu o Atributo inicial mantém o direito de escolher um novo Atributo, a partir da própria próxima Carta do topo.
FR-20: O vencedor da nova Rodada de desempate coleta a nova Carta jogada, as novas Cartas dos adversários, e todas as Cartas retidas no Funil.
FR-21: O sistema elimina da Partida o Jogador cujo Monte chegue a zero Cartas.
FR-22: O sistema encerra a Partida e declara vitória quando um único Jogador centraliza todas as 32 Cartas do Baralho.
FR-23: Se um Jogador humano perder a conexão durante uma Partida em andamento, o sistema atribui o assento dele a uma IA, que assume o Monte e o estado exatamente de onde ele parou.
FR-24: O sistema disponibiliza uma FAQ com as regras completas do jogo, acessível a partir da tela inicial, nunca exibida na Mesa de Jogo.

*(FR-25 a FR-32: levantados pelo Mauricio após os Épicos 1-4 em produção, via sessão de feedback pós-lançamento — não vêm do PRD original, mas seguem a mesma numeração pra manter a rastreabilidade.)*

FR-25: O sistema exibe o resultado da Rodada (Chip de Resultado) numa posição sempre visível — sem exigir rolagem — tanto em mobile quanto em desktop, dentro da janela de revelação.
FR-26: O sistema exibe a bandeira do país de cada Carta usando um asset de imagem real (SVG/PNG), não dependente de renderização de emoji do sistema operacional.
FR-27: O host pode copiar o link de convite da sala com um único clique/toque, recebendo confirmação visual da cópia.
FR-28: Cada Carta exibe a foto real do carro correspondente, carregada a partir de um arquivo de imagem referenciado nos dados do Baralho.
FR-29: O Baralho define a Carta do Jaguar F-Type R como a Carta Super Trunfo, substituindo a Ferrari 812 Superfast atual.
FR-30: Os valores numéricos exibidos em cada Atributo respeitam exatamente a precisão decimal da fonte de dados (`docs/carros_specs.csv`), sem artefatos de ponto flutuante.
FR-31: A Carta exibe o nome do modelo do carro, visível entre a foto e a primeira Linha de Atributo.
FR-32: O jogador vê a própria contagem de Cartas restantes na Mesa de Jogo, no mesmo padrão visual usado para os oponentes.

### NonFunctional Requirements

NFR-1 (Desempenho): transições de Rodada, comparações de valores e animações de Carta não devem exceder 1,5s de processamento no servidor.
NFR-2 (Escalabilidade): o backend deve suportar conexões WebSocket simultâneas para manter o estado da Partida em tempo real entre múltiplos Jogadores, dimensionado para uso hobby (não escala pública).
NFR-3 (Segurança / Anti-cheat): o estado do Monte de cada Jogador deve ser protegido — nenhum cliente pode inspecionar Cartas fora de hora via console/API.
NFR-4 (Responsividade): a interface web deve funcionar perfeitamente em dispositivos móveis e desktops.

### Additional Requirements

*(Da Arquitetura — `ARCHITECTURE-SPINE.md`, 11 ADs)*

- **Sem starter template pinado.** A Arquitetura não especifica um scaffold/boilerplate específico — só a stack (Node 24 LTS, TypeScript, Colyseus 0.17.x + `@colyseus/sdk` ~0.17.42, React 19.2.x, Vite 8.x). O Épico 1 / História 1 precisa cobrir o scaffolding do zero: `frontend/` (Vite + React + TS) e `backend/` (Node + TS + Colyseus) como pacotes separados no mesmo repositório (AD-10), sem import de código entre eles.
- **Paradigma servidor autoritativo** (AD-1): todo estado de jogo vive só no backend; frontend nunca decide regra, só envia intents da lista fechada: `jogarCarta`, `iniciarPartida`, `criarSala`, `entrarSala`.
- **Uma Colyseus Room = todo o ciclo de vida de uma Partida** (AD-2), com `joinById(roomId)` via link de convite — nunca matchmaking genérico.
- **Visibilidade de Carta filtrada no servidor** (AD-3): duas representações de estado (canônico não filtrado para lógica de jogo/IA; view filtrada por cliente na borda de rede). Carta do topo inteira revelada a todos ao entrar em `Revelando`; fora disso, só contagem de Cartas do oponente.
- **IA in-process, aplicada atomicamente** (AD-4): `decidirAtributoIA` síncrona, chamada dentro da mesma transição de estado; qualquer atraso de ritmo visual é só client-side.
- **Game loop como máquina de estados explícita** (AD-5), com o diagrama de estados da Arquitetura como contrato: `AguardandoJogadores → AguardandoSelecao → Revelando → ResolvendoRodada → (Funil | AguardandoSelecao | FimDePartida)`, mais `SuperTrunfoAcionado`. Três semânticas de entrada distintas em `AguardandoSelecao` (vencedor muda o turno / Funil mantém o turno / eliminação pula jogador). Jogador Inicial = sempre o host `[SUPOSIÇÃO]`.
- **Regra de sobra na distribuição** (AD-6, resolve PRD §8.3): fórmula geral `Math.floor(32/n)` por Jogador, `32 % n` descartadas.
- **Atributos inversos como dado** (AD-7, resolve PRD §8.4): campo `inverso: boolean` por Atributo; só Aceleração 0-100 km/h é inverso hoje. `[SUPOSIÇÃO não confirmada]`.
- **Desempate de múltiplas Cartas letra "A"** (AD-8, resolve PRD §8.5): por ordem de entrada na Room (join order). `[SUPOSIÇÃO não confirmada]`.
- **Reconexão** (AD-9, resolve PRD §8.6): mecanismo `allowReconnection` do Colyseus + token de sessão + janela de 60s; controle só volta ao humano no fim da cadeia de desempate corrente, nunca no meio. `[ADOTADO via UX, não confirmado]`.
- **Envelope de implantação** (AD-11): backend como processo Node long-running (Railway/Render/Fly.io — nunca serverless); frontend como build estático; um único ambiente de produção, sem staging.
- **Pirâmide de testes** (AD-12, adicionada após rodada de party-mode com o time): unitário (Vitest, `backend/src/game/`), integração de Room (`@colyseus/testing`), componente (Vitest+React Testing Library), E2E (Playwright). Unitário e integração de Room priorizados — pegam bug de regra, o mais caro neste projeto. Montada na História 1.1; toda história daí em diante inclui os testes da(s) camada(s) relevante(s) como parte do "pronto".
- **Convenções**: nomes de domínio em português verbatim do Glossário do PRD no código; ID de Carta sempre `{grupo}{letra}`; toda mutação de estado passa por handler de mensagem da Room.
- **Pendência de conteúdo, não de arquitetura**: qual Carta recebe a flag Super Trunfo (PRD §8.1) — `docs/carros_specs.csv` tem todas as 32 linhas com `SuperTrunfo=false`; alguém precisa marcar uma antes de uma Partida real funcionar de ponta a ponta. *(Resolvido pelos Épicos 1-4 em produção — Ferrari 812 Superfast; Épico 5/FR-29 troca pra Jaguar F-Type R.)*

*(Additional Requirements abaixo: achados da sessão de feedback pós-lançamento, Épico 5.)*

- **Limitação de plataforma descoberta em produção**: emoji de bandeira de país (🇮🇹, 🇩🇪, etc.) não renderiza corretamente no Windows — o SO mostra o código de duas letras dentro de uma caixa em vez da bandeira. `docs/carros_specs.csv` continua sendo a fonte de dados dos países; o Épico 5 troca só a representação visual (asset de imagem real, FR-26), nunca o dado em si.
- **`docs/carros_specs.csv` permanece a fonte da verdade dos dados dos carros** (decisão confirmada com o Mauricio, Épico 5) — ganha uma coluna nova (`Imagem`) em vez de migrar de formato. O pipeline de carregamento (`backend/src/game/baralho.ts` → `schema/Carta.ts` → `frontend/.../Carta.tsx`) precisa propagar esse campo novo.
- **Pendência de conteúdo, não de arquitetura (Épico 5)**: origem das imagens dos carros a usar nos cards. O Mauricio tem 32 fotos hoje (fora do repo), mas sinalizou abertura a trocar por fontes "mais seguras" do ponto de vista de direito de imagem, mantendo tudo commitado no repositório (pra quem baixar o projeto ter os assets completos). Qual fonte usar — as fotos atuais, um banco de imagem livre, material de imprensa com uso editorial liberado, ou outra — não foi decidido; a História 5.4 precisa resolver isso como um "Ask First" antes de commitar qualquer imagem.

### UX Design Requirements

*(De `DESIGN.md` + `EXPERIENCE.md` — identidade pop-art/colecionável, mockups em `mockups/`)*

UX-DR1: Tokens de design (cores, tipografia incl. efeitos "letra bolha" e "halo-label", raio de borda, espaçamento) implementados conforme o frontmatter de `DESIGN.md` — paleta amarelo/vermelho/laranja pop-art com grade quadriculada de marca.
UX-DR2: Componente **Carta** — sem faixa de cabeçalho colorida, sem nome do modelo; foto do carro dominante (~58% da altura, com placeholder até fotos reais chegarem); badge de bandeira do país (canto superior esquerdo) e badge de Grupo/Letra (canto superior direito) sobre a foto; moldura vermelha grossa (dourada + selo estrelado se Super Trunfo).
UX-DR3: Componente **Carta (verso)** — fundo amarelo com grade, nenhuma informação identificável (nem Grupo/Letra) antes da revelação.
UX-DR4: Componente **Linha de Atributo** — clicável só na vez do Jogador; clique único já revela e resolve a Rodada (sem confirmação); estado selecionado com fundo laranja/texto escuro; altura mínima de toque 44px.
UX-DR5: Componente **Botão Primário** — vermelho com texto branco; estado desabilitado quando ação inválida (nome vazio, mínimo de Jogadores não atingido).
UX-DR6: Componente **Lista da Sala de Espera** — nome do Jogador humano ou pílula "IA"; atualiza em tempo real.
UX-DR7: Componente **Chip de Resultado** — formato selo estrelado/starburst (não pílula genérica); borda semântica (verde/âmbar/vermelho) + texto sempre presente, nunca só cor.
UX-DR8: Componente **Banner de Vitória** — Chip de Resultado + animação de confete, na Rodada e na Partida.
UX-DR9: Componente **Funil** — cartão com grade de fundo sutil e borda tracejada âmbar, na área central da Mesa.
UX-DR10: Componente **FAQ** — lista de perguntas expansíveis (accordion), acento amarelo só como detalhe, nunca fundo de texto longo; conteúdo real das perguntas ainda não escrito (pendência separada, não bloqueia a UI).
UX-DR11: Telas/IA completas conforme `mockups/`: Criar Sala (+ FAQ link), Entrar na Sala (+ estados de erro: nome vazio, sala cheia/link inválido), Sala de Espera, Mesa de Jogo, Fim de Partida, FAQ.
UX-DR12: Animações — viragem de Carta na revelação, Cartas voando pro Monte do vencedor, confete; todas respeitando `prefers-reduced-motion`. Sem som.
UX-DR13: Piso de acessibilidade — foco visível em Tab (não navegação completa por teclado), nenhuma informação de resultado só por cor, contraste sempre tinta escura sobre superfície clara.
UX-DR14: Responsivo mobile-first — layout empilhado na Mesa (mobile) escalando pra layout espacial (desktop), sem breakpoint específico fixado.
UX-DR15: Voz e tom — microcópia em português direto, tom caloroso mas não infantilizado, termos do Glossário do PRD verbatim, sem jargão técnico exposto ao Jogador.

### FR Coverage Map

FR-1: Epic 2 - instanciação do Baralho
FR-2: Epic 2 - identificação e atributos da Carta
FR-3: Epic 2 - Carta Super Trunfo
FR-4: Epic 2 - agrupamento temático
FR-5: Epic 1 (configuração/declaração de IA na criação da sala) + Epic 3 (IA jogando de fato)
FR-6: Epic 2 - embaralhamento
FR-7: Epic 2 - distribuição de Cartas
FR-8: Epic 2 - Monte em fila (FIFO)
FR-9: Epic 2 - Jogador Inicial
FR-10: Epic 2 - seleção de Atributo
FR-11: Epic 2 - revelação simultânea
FR-12: Epic 2 - comparação e vencedor
FR-13: Epic 2 - coleta de Cartas
FR-14: Epic 2 - direito de escolha na próxima Rodada
FR-15: Epic 2 - vitória automática (Super Trunfo)
FR-16: Epic 2 - exceção da Carta letra "A"
FR-17: Epic 2 - vitória da Carta letra "A"
FR-18: Epic 2 - retenção no Funil
FR-19: Epic 2 - novo Atributo do desempate
FR-20: Epic 2 - coleta do desempate
FR-21: Epic 2 - eliminação
FR-22: Epic 2 - fim de Partida
FR-23: Epic 3 - substituição permanente por IA em desconexão
FR-24: Epic 4 - FAQ de Regras
FR-25: Epic 5 - visibilidade do resultado da Rodada
FR-26: Epic 5 - bandeiras como asset de imagem real
FR-27: Epic 5 - copiar link de convite
FR-28: Epic 5 - fotos reais dos carros
FR-29: Epic 5 - troca da Carta Super Trunfo
FR-30: Epic 5 - precisão decimal dos Atributos
FR-31: Epic 5 - nome do carro na Carta
FR-32: Epic 5 - contagem própria de Cartas na Mesa

## Epic List

### Epic 1: Sala e Convite
Mauricio consegue criar uma sala, declarar quantos jogadores e quantos são IA, compartilhar o link, ver a família entrando em tempo real na sala de espera, e iniciar — tudo publicado num link real que dá pra mandar pra fora de casa.
**FRs covered:** FR-5 (parte de configuração/declaração)

### Epic 2: Partida Completa
Um grupo de jogadores joga uma Partida do Super Trunfo do início ao fim: baralho, distribuição, escolha de atributo, revelação, comparação, coleta, a carta Super Trunfo com sua exceção, o Funil de desempate, eliminação e vitória final — todas as regras do jogo físico, automatizadas e corretas.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22

### Epic 3: Jogador Artificial & Continuidade
O jogo continua de pé mesmo quando falta gente: a IA realmente joga (não só ocupa a vaga) quando não há humano suficiente, e se alguém cair no meio de uma Partida, uma IA assume o lugar dele permanentemente, sem travar os outros.
**FRs covered:** FR-5 (IA jogando de fato), FR-23

### Epic 4: FAQ de Regras
Qualquer jogador consegue relembrar as regras do jogo direto na tela inicial, sem precisar perguntar pra ninguém — nunca durante a Partida.
**FRs covered:** FR-24

### Epic 5: Polish Pós-Lançamento
Com os quatro épicos anteriores já em produção e a família jogando de verdade, uma leva de correções e melhorias levantadas no uso real: o resultado da Rodada deixa de ficar escondido abaixo da dobra, bandeiras renderizam de verdade em qualquer sistema operacional, dá pra compartilhar o link com um clique, os carros ganham foto e nome de verdade no card, a Carta Super Trunfo passa a ser o Jaguar F-Type R, os números respeitam a precisão do dado de origem, e cada jogador vê a própria contagem de cartas.
**FRs covered:** FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32

## Epic 1: Sala e Convite

Mauricio consegue criar uma sala, declarar quantos jogadores e quantos são IA, compartilhar o link, ver a família entrando em tempo real na sala de espera, e iniciar — tudo publicado num link real que dá pra mandar pra fora de casa.

**FRs covered:** FR-5 (parte de configuração/declaração)
**NFRs covered:** NFR-2 (escalabilidade dimensionada pro uso hobby, via AD-11), NFR-4 (responsividade — telas deste épico seguem o layout mobile-first do `EXPERIENCE.md`)
**UX-DRs covered:** UX-DR1, UX-DR5, UX-DR6, UX-DR11 (Criar Sala, Entrar na Sala, Sala de Espera), UX-DR13, UX-DR14, UX-DR15
**Additional Requirements covered:** scaffolding (frontend/backend, AD-10), AD-1/AD-2 (contrato de mensagens `criarSala`/`entrarSala`/`iniciarPartida`), AD-11 (implantação), AD-12 (pirâmide de testes)

### Story 1.1: Scaffolding do Projeto

Como Mauricio (criador),
Eu quero ter o `frontend/` (Vite+React+TS) e o `backend/` (Node+TS+Colyseus) rodando localmente como pacotes separados, com a pirâmide de testes já montada,
Para que eu possa construir o resto do jogo sobre uma base sólida e testável desde a primeira história.

**Acceptance Criteria:**

**Given** um repositório vazio de código
**When** o scaffolding é executado
**Then** existem as pastas `frontend/` e `backend/` com `package.json` próprios, sem import de código de um para o outro (AD-10)
**And** `frontend/` roda com Vite+React+TS e `backend/` roda um servidor Colyseus mínimo, ambos localmente
**And** o frontend consegue abrir uma conexão WebSocket de teste com o backend via `@colyseus/sdk`

**Given** o scaffolding de `frontend/` e `backend/` concluído
**When** a pirâmide de testes é montada (AD-12)
**Then** `Vitest` roda em `backend/` (testes unitários) e em `frontend/` (testes de componente, com `React Testing Library`)
**And** `@colyseus/testing` está configurado em `backend/` para testes de integração de Room
**And** `Playwright` está configurado na raiz do repositório para testes E2E
**And** um teste trivial de cada camada passa (`npm test` verde nas quatro), servindo de exemplo pras próximas histórias

### Story 1.2: Criar Sala

Como anfitrião,
Eu quero criar uma sala informando meu nome, o total de jogadores e quantos são IA,
Para que eu possa convidar minha família.

**Acceptance Criteria:**

**Given** a Tela Inicial
**When** informo meu nome, escolho o total de Jogadores (2-4) e quantos são IA, e confirmo
**Then** uma `PartidaRoom` é criada (AD-2) com um `roomId` único
**And** recebo um link de convite baseado nesse `roomId`
**And** sou levado à Sala de Espera como host

### Story 1.3: Entrar na Sala

Como convidado,
Eu quero abrir o link recebido e entrar na sala informando meu nome,
Para que eu possa participar da partida.

**Acceptance Criteria:**

**Given** um link de convite válido
**When** abro o link, informo meu nome e confirmo
**Then** entro na `PartidaRoom` correspondente via `joinById(roomId)` (AD-2) — nunca matchmaking genérico
**And** sou levado à Sala de Espera, visível para os demais

**Given** um link de sala que não existe mais, ou uma sala já cheia
**When** tento entrar
**Then** vejo uma mensagem clara ("Esta sala não existe mais" / "Esta sala já está cheia"), sem travar

### Story 1.4: Sala de Espera

Como qualquer jogador na sala,
Eu quero ver quem já entrou em tempo real,
Para que eu saiba quando a partida pode começar.

**Acceptance Criteria:**

**Given** estou na Sala de Espera
**When** outro jogador entra ou sai
**Then** a lista atualiza em tempo real, mostrando nome (humano) ou pílula "IA"

**Given** sou o host
**When** o mínimo de 2 Jogadores totais (humanos + IA) é atingido
**Then** o botão "Iniciar" fica habilitado

### Story 1.5: Publicar o Jogo

Como Mauricio,
Eu quero que o jogo esteja acessível por um link real na internet,
Para que eu possa mandar para família e amigos fora de casa.

**Acceptance Criteria:**

**Given** o backend e o frontend prontos localmente
**When** faço o deploy
**Then** o backend roda como processo Node de longa duração (nunca serverless — AD-11) num host que sustente WebSocket persistente
**And** o frontend está publicado como build estático, na mesma origem lógica
**And** um link de sala criado em produção funciona de ponta a ponta para um convidado em outra rede

## Epic 2: Partida Completa

Um grupo de jogadores joga uma Partida do Super Trunfo do início ao fim: baralho, distribuição, escolha de atributo, revelação, comparação, coleta, a carta Super Trunfo com sua exceção, o Funil de desempate, eliminação e vitória final — todas as regras do jogo físico, automatizadas e corretas.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22
**NFRs covered:** NFR-1 (desempenho), NFR-3 (anti-cheat), NFR-4 (responsividade — Mesa de Jogo mobile-first)
**UX-DRs covered:** UX-DR2, UX-DR3, UX-DR4, UX-DR7, UX-DR8, UX-DR9, UX-DR12
**Additional Requirements covered:** AD-3 (visibilidade filtrada), AD-5 (máquina de estados, Jogador Inicial = host), AD-6 (regra de sobra), AD-7 (atributos inversos), AD-8 (desempate letra "A")

### Story 2.1: Baralho, Distribuição e Minha Carta

Como jogador,
Eu quero que a partida comece com o baralho embaralhado e distribuído, e ver minha própria carta do topo,
Para que eu possa começar a jogar.

**Acceptance Criteria:**

**Given** o host clicou "Iniciar" (FR-5/História 1.4)
**When** a Partida começa
**Then** o sistema instancia o Baralho de 32 Cartas (FR-1) com ID, Grupo, Atributos e a flag Super Trunfo de `docs/carros_specs.csv` (FR-2, FR-3, FR-4)
**And** as Cartas são embaralhadas aleatoriamente (FR-6) e distribuídas igualmente (FR-7) — com 3 Jogadores, 10 cartas cada e 2 descartadas (AD-6)
**And** cada Jogador vê a própria Carta do topo do Monte (componente Carta, UX-DR2), com foto/bandeira/badge Grupo-Letra, sem ver o Monte completo próprio ou alheio (FR-8, NFR-3/AD-3)
**And** as Cartas dos oponentes aparecem como Carta (verso) — nenhuma informação identificável visível (UX-DR3)

### Story 2.2: Seleção de Atributo e Revelação

Como Jogador da vez,
Eu quero escolher um atributo da minha carta e ver a revelação simultânea de todos,
Para que eu saiba quem tem o maior valor.

**Acceptance Criteria:**

**Given** é o início da primeira Rodada da Partida
**When** a Partida define o Jogador Inicial
**Then** o host é sempre o Jogador Inicial (AD-5, confirmado)

**Given** sou o Jogador da vez
**When** clico numa Linha de Atributo da minha Carta (clique único, UX-DR4)
**Then** o sistema aceita só Atributos presentes na minha Carta do topo (FR-10)
**And** as Cartas do topo de todos os Jogadores ativos viram simultaneamente, revelando o valor desse Atributo (FR-11)
**And** essa revelação acontece em até 1,5s de processamento no servidor (NFR-1)

### Story 2.3: Comparação, Vencedor e Próxima Rodada

Como jogador,
Eu quero que o sistema declare o vencedor da rodada corretamente e passe a vez pra ele,
Para que o jogo flua sem precisar de árbitro.

**Acceptance Criteria:**

**Given** os valores do Atributo foram revelados
**When** o sistema compara os valores
**Then** vence o maior valor — exceto Aceleração 0-100 km/h, onde vence o menor (FR-12, confirmado: só esse Atributo é inverso)
**And** o vencedor coleta todas as Cartas jogadas na Rodada, inseridas no fundo do próprio Monte (FR-13)
**And** o vencedor escolhe o Atributo da próxima Rodada (FR-14)
**And** o resultado aparece via Chip de Resultado com texto, nunca só cor (UX-DR7), com as cartas "voando" pro Monte do vencedor (UX-DR8/UX-DR12)

### Story 2.4: Carta Super Trunfo

Como jogador com a carta Super Trunfo,
Eu quero vencer a rodada automaticamente ao jogá-la,
Para que a menos que um oponente tenha uma carta "letra A".

**Acceptance Criteria:**

**Given** jogo minha Carta do topo e ela tem a flag Super Trunfo (é a `2A`, Ferrari 812 Superfast)
**When** nenhum oponente tem Carta terminada em "A" nessa Rodada
**Then** venço a Rodada automaticamente, sem comparação de Atributos (FR-15)

**Given** acionei o Super Trunfo
**When** algum oponente tem Carta terminada em "A" na mesma Rodada
**Then** a vitória automática é anulada (FR-16) e o Jogador com a Carta "A" vence, coletando o Super Trunfo e as demais Cartas (FR-17)
**And** se mais de um oponente tiver Carta "A", vence quem estiver mais próximo na ordem de entrada na sala (AD-8, confirmado)

### Story 2.5: Funil (Desempate)

Como jogador,
Eu quero que um empate mande as cartas pro Funil e o jogo continue com um novo atributo,
Para que a rodada sempre tenha um vencedor.

**Acceptance Criteria:**

**Given** há empate no maior valor do Atributo selecionado
**When** o sistema detecta o empate
**Then** todas as Cartas da Rodada vão para o Funil (FR-18), exibido como bandeja com borda tracejada (UX-DR9)
**And** o Jogador que abriu a Rodada empatada escolhe um novo Atributo com a próxima Carta do topo (FR-19)
**And** o vencedor dessa nova Rodada coleta a nova Carta, as novas Cartas dos adversários, e tudo que estava no Funil (FR-20)

### Story 2.6: Fim de Jogo e Eliminação

Como jogador,
Eu quero ser eliminado quando meu monte zerar e ver a partida terminar quando alguém reunir as 32 cartas,
Para que eu saiba quando o jogo realmente acabou.

**Acceptance Criteria:**

**Given** o Monte de um Jogador chega a zero Cartas
**When** isso é detectado
**Then** o Jogador é eliminado — não escolhe mais Atributo nem tem Cartas reveladas (FR-21)

**Given** um único Jogador reúne as 32 Cartas do Baralho
**When** isso é detectado
**Then** a Partida é encerrada e a vitória declarada (FR-22), com o Banner de Vitória e confete (UX-DR8/UX-DR12)
**And** nenhuma nova Rodada é iniciada depois disso

## Epic 3: Jogador Artificial & Continuidade

O jogo continua de pé mesmo quando falta gente: a IA realmente joga (não só ocupa a vaga) quando não há humano suficiente, e se alguém cair no meio de uma Partida, uma IA assume o lugar dele permanentemente, sem travar os outros.

**FRs covered:** FR-5 (IA jogando de fato), FR-23
**Additional Requirements covered:** AD-4 (IA in-process, aplicada atomicamente), AD-9 (desconexão permanente, sem reconexão)

### Story 3.1: IA Preenche e Joga

Como jogador,
Eu quero que vagas não preenchidas por humanos sejam assumidas pela IA e que ela realmente jogue,
Para que eu possa jogar mesmo sem gente suficiente.

**Acceptance Criteria:**

**Given** o host inicia a Partida
**When** alguma vaga humana ainda não foi preenchida (além da quantidade de IA já declarada na criação da sala)
**Then** essa vaga também vira IA automaticamente (FR-5, rede de segurança)

**Given** é a vez de um Jogador controlado por IA
**When** a máquina de estados entra em `AguardandoSelecao` para esse assento
**Then** `decidirAtributoIA` é chamada síncrona e in-process, e o resultado é aplicado atomicamente na mesma transição — nenhuma outra mensagem é processada nesse meio-tempo (AD-4)
**And** se houver ritmo visual de "pensando", o atraso é só do lado do cliente, nunca do servidor

### Story 3.2: Continuidade por Desconexão

Como jogador,
Eu quero que a partida continue sem travar se alguém cair,
Para que eu não perca o jogo por causa da internet de uma pessoa.

**Acceptance Criteria:**

**Given** uma Partida em andamento
**When** um Jogador humano perde a conexão
**Then** o sistema atribui o assento dele a uma IA, que assume o Monte e o estado exatamente de onde ele parou (FR-23)
**And** a Partida continua sem interrupção para os demais

**Given** o assento foi assumido pela IA
**When** o Jogador original reabre o link, mesmo dentro da mesma Partida
**Then** ele não retoma o assento em nenhuma circunstância — o assento fica com a IA até a Partida terminar (AD-9, confirmado: sem reconexão nesta versão)

## Epic 4: FAQ de Regras

Qualquer jogador consegue relembrar as regras do jogo direto na tela inicial, sem precisar perguntar pra ninguém — nunca durante a Partida.

**FRs covered:** FR-24
**UX-DRs covered:** UX-DR10, UX-DR11 (tela FAQ)

### Story 4.1: FAQ de Regras

Como jogador,
Eu quero consultar as regras completas do jogo na tela inicial,
Para que eu possa relembrar como jogar sem precisar perguntar pra alguém.

**Acceptance Criteria:**

**Given** estou na Tela Inicial (antes de criar ou entrar numa sala)
**When** acesso a FAQ
**Then** vejo uma lista de perguntas expansíveis (accordion, UX-DR10) cobrindo: estrutura do Baralho, o game loop, a Carta Super Trunfo e sua exceção, o Funil de desempate, e o fim de jogo (FR-24)
**And** consigo voltar pra Tela Inicial a qualquer momento

**Given** estou na Mesa de Jogo, numa Partida em andamento
**When** procuro a FAQ
**Then** ela não aparece em nenhuma superfície da Mesa de Jogo — só é alcançável pela Tela Inicial

## Epic 5: Polish Pós-Lançamento

Com os quatro épicos anteriores já em produção e a família jogando de verdade, uma leva de correções e melhorias levantadas no uso real: o resultado da Rodada deixa de ficar escondido abaixo da dobra, bandeiras renderizam de verdade em qualquer sistema operacional, dá pra compartilhar o link com um clique, os carros ganham foto e nome de verdade no card, a Carta Super Trunfo passa a ser o Jaguar F-Type R, os números respeitam a precisão do dado de origem, e cada jogador vê a própria contagem de cartas.

**FRs covered:** FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32
**NFRs covered:** NFR-4 (responsividade — a História 5.1 é diretamente sobre isso, tanto mobile quanto desktop)
**UX-DRs covered:** UX-DR2 (Carta ganha foto real + nome, revisando o "sem nome do modelo" original), UX-DR7 (Chip de Resultado, reposicionamento), UX-DR13/UX-DR14 (piso de acessibilidade e responsividade, aplicados à correção de visibilidade)
**Additional Requirements covered:** limitação de plataforma (emoji de bandeira no Windows), `docs/carros_specs.csv` ganhando coluna `Imagem` (ver Additional Requirements acima)

### Story 5.1: Resultado da Rodada Sempre Visível

Como jogador,
Eu quero ver o resultado da Rodada assim que ela resolve, sem precisar rolar a tela,
Para que eu não perca a informação de quem ganhou durante a pausa de revelação.

**Acceptance Criteria:**

**Given** uma Rodada acabou de resolver (com ou sem empate)
**When** o Chip de Resultado aparece
**Then** ele fica visível na tela sem exigir rolagem, tanto em mobile quanto em desktop (FR-25, NFR-4)
**And** permanece legível durante toda a janela de revelação (2,5s), mesmo que o resto da Mesa não caiba na viewport

### Story 5.2: Bandeiras de País como Imagem Real

Como jogador,
Eu quero ver a bandeira de verdade do país de cada carro,
Para que a informação do país seja reconhecível em qualquer sistema operacional, incluindo Windows.

**Acceptance Criteria:**

**Given** uma Carta de qualquer país presente em `docs/carros_specs.csv` (Alemanha, Reino Unido, Itália, França, Estados Unidos)
**When** a Carta é renderizada
**Then** a bandeira aparece como asset de imagem real (SVG/PNG), nunca como emoji de bandeira do sistema operacional (FR-26)
**And** o resultado é visualmente idêntico em Windows, macOS e Android

### Story 5.3: Compartilhar Link da Sala

Como host,
Eu quero copiar o link de convite com um clique,
Para que eu possa mandar pra família e amigos sem precisar selecionar o texto manualmente.

**Acceptance Criteria:**

**Given** estou na Sala de Espera como host, com o link de convite visível
**When** clico no botão de copiar
**Then** o link é copiado pra área de transferência (FR-27)
**And** recebo uma confirmação visual de que a cópia funcionou

### Story 5.4: Fotos Reais dos Carros

Como jogador,
Eu quero ver a foto de verdade do carro em cada Carta,
Para que o jogo pareça de verdade, não com placeholder.

**Ask First (a resolver antes de implementar):** qual a origem das 32 imagens a commitar no repositório — as fotos que o Mauricio já tem, ou uma fonte alternativa mais segura do ponto de vista de direito de imagem/licenciamento? Precisam ficar versionadas no repositório de qualquer forma (pra quem baixar o projeto ter os assets completos), mas a fonte exata ainda não foi decidida.

**Acceptance Criteria:**

**Given** `docs/carros_specs.csv` ganha uma coluna nova (`Imagem`) apontando pro arquivo de imagem de cada carro
**When** o Baralho é carregado
**Then** o campo de imagem é propagado do CSV até o schema da Carta (`backend/src/schema/Carta.ts`) e até o frontend (FR-28)

**Given** uma Carta com imagem definida
**When** ela é renderizada (própria ou de oponente, em qualquer estado de revelação)
**Then** a foto real do carro aparece no lugar do placeholder atual (🚗)

### Story 5.5: Trocar a Carta Super Trunfo

Como Mauricio,
Eu quero que o Jaguar F-Type R seja a Carta Super Trunfo,
Para que essa seja a carta mais especial do baralho.

**Acceptance Criteria:**

**Given** `docs/carros_specs.csv`
**When** os dados do Baralho são atualizados
**Then** a linha do Jaguar F-Type R (`6D`) passa a ter `SuperTrunfo=true`, e a linha da Ferrari 812 Superfast (`2A`) passa a ter `SuperTrunfo=false` (FR-29)
**And** o Baralho continua com exatamente 32 Cartas e exatamente 1 com a flag Super Trunfo (invariantes de `backend/src/game/baralho.ts`, FR-1/FR-3 inalterados)

### Story 5.6: Precisão Numérica dos Atributos

Como jogador,
Eu quero ver os números dos Atributos exatamente como estão na fonte de dados,
Para que a comparação entre Cartas seja clara e sem números estranhos.

**Acceptance Criteria:**

**Given** uma Carta com valor fracionário no Atributo Aceleração 0-100 km/h (ex: `3.2`)
**When** o valor é transmitido do servidor pro cliente e exibido
**Then** o valor mostrado tem exatamente a mesma precisão decimal do `docs/carros_specs.csv` — nunca artefato de ponto flutuante (ex: `3.200000047683716`) (FR-30)

### Story 5.7: Nome do Carro na Carta

Como jogador,
Eu quero ver o nome do modelo do carro na própria Carta,
Para que eu saiba qual carro é aquele sem precisar decorar o código Grupo/Letra.

**Acceptance Criteria:**

**Given** qualquer Carta renderizada (própria ou de oponente, em qualquer estado de revelação)
**When** ela aparece na tela
**Then** o nome do modelo do carro é exibido entre a foto e a primeira Linha de Atributo (Velocidade Máxima) (FR-31)

### Story 5.8: Contagem Própria de Cartas na Mesa

Como jogador,
Eu quero ver quantas cartas eu tenho no momento,
Para que eu acompanhe meu próprio progresso na Partida, do mesmo jeito que já vejo a contagem dos oponentes.

**Acceptance Criteria:**

**Given** estou na Mesa de Jogo, numa Partida em andamento
**When** olho pra minha própria área da Mesa
**Then** vejo minha contagem atual de Cartas (FR-32), no mesmo padrão visual usado pra contagem dos oponentes
