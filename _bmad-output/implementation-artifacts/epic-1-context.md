# Epic 1 Context: Sala e Convite

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Este épico entrega a fundação técnica do projeto (scaffolding de `frontend/` e `backend/` com a pirâmide de testes já montada) e o fluxo completo de criação/entrada em sala: o host cria uma sala declarando nome, total de jogadores (2-4) e quantos são IA; um convidado abre o link recebido e entra informando o próprio nome; todos veem a Sala de Espera atualizar em tempo real; e o host inicia a Partida quando o mínimo de 2 jogadores é atingido. Fecha com o deploy real — o jogo publicado num link que funciona de ponta a ponta para alguém em outra rede. Este épico cobre só a parte de configuração/declaração de IA (quantos assentos são IA); a IA de fato jogando e a rede de segurança que converte vagas humanas não preenchidas em IA no início da Partida são do Épico 3.

## Stories

- Story 1.1: Scaffolding do Projeto
- Story 1.2: Criar Sala
- Story 1.3: Entrar na Sala
- Story 1.4: Sala de Espera
- Story 1.5: Publicar o Jogo

## Requirements & Constraints

- Uma Partida suporta de 2 a 4 Jogadores totais (humanos + IA); o host declara explicitamente, na criação da sala, o total de Jogadores e quantos desses são IA.
- Uma Partida nunca inicia com menos de 2 Jogadores totais — o botão "Iniciar" só habilita quando esse mínimo é atingido.
- O backend deve sustentar conexões WebSocket simultâneas para estado de sala em tempo real, dimensionado para uso hobby (família/amigos, poucas salas simultâneas) — não para escala pública.
- A interface deste épico (Criar Sala, Entrar na Sala, Sala de Espera) deve funcionar bem em mobile e desktop.
- Sem matchmaking com desconhecidos: entrar numa sala é sempre via link de convite específico daquela sala, nunca uma fila genérica.
- Sem login/contas persistentes — identificação é só o nome digitado ao criar/entrar.
- Critério de sucesso do produto (fora do épico, mas relevante como teto): uma Partida completa precisa rodar sem travar; este épico é a porta de entrada que viabiliza isso — link de sala criado em produção deve funcionar ponta a ponta para um convidado em outra rede.

## Technical Decisions

- **Sem starter template.** Scaffolding do zero: `frontend/` (Vite + React 19.2.x + TS) e `backend/` (Node 24 LTS + TS + Colyseus 0.17.x) como pacotes independentes no mesmo repositório — nenhum import de código de um para o outro; toda comunicação entre eles é rede (protocolo Colyseus/WebSocket via `@colyseus/sdk` ~0.17.42).
- **Estrutura de pastas (Structural Seed):** `backend/src/{rooms,game,schema}/`, `frontend/src/{components,screens,client}/`, `docs/carros_specs.csv` como fonte de dados (não copiado para o backend).
- **Uma Colyseus Room = todo o ciclo de vida de uma Partida.** Criar Sala = criar uma instância de `PartidaRoom` (gera um `roomId`, base do link de convite). Entrar na Sala = `joinById(roomId)` a partir do link — nunca `joinOrCreate`/matchmaking genérico.
- **Contrato de mensagens (lista fechada, cliente → servidor) relevante a este épico:**
  - `criarSala` `{ nome: string, totalJogadores: number, totalIA: number }` — fora de uma Room; cria a `PartidaRoom` já com o total de Jogadores e a quantidade de IA declarados pelo host (não existe outro intent pra configurá-los depois — a Sala nasce com essa forma).
  - `entrarSala` `{ nome: string, roomId: string }` — fora de uma Room; leva a `joinById(roomId)` (AD-2), nunca matchmaking genérico.
  - `iniciarPartida` `{}` — só do host, só em `AguardandoJogadores`; fecha a Sala de Espera e dispara embaralhar/distribuir/definir Jogador Inicial (lógica de jogo em si é do Épico 2) → transição para `AguardandoSelecao`.
- Nenhuma decisão de jogo é tomada no frontend; ele só renderiza estado recebido e captura intenção (clique).
- **Envelope de implantação:** backend como processo Node de longa duração (Railway/Render/Fly.io ou equivalente) — nunca serverless (mata WebSocket persistente e estado em memória). Frontend como build estático (`vite build`), podendo ser servido pelo mesmo processo do backend ou por host estático separado — mesma origem lógica para o Jogador. Um único ambiente de produção, sem staging. Config via `.env` (backend) / `import.meta.env` (frontend), nunca hardcoded.
- **Pirâmide de testes, montada nesta história (1.1)** e esperada como parte do "pronto" em toda história daí em diante: `Vitest` em `backend/` (unitário) e `frontend/` (componente, com `React Testing Library`); `@colyseus/testing` em `backend/` para integração de Room; `Playwright` na raiz do repo para E2E. Prioridade se o tempo apertar: unitário e integração de Room primeiro (pegam bug de regra).
- Nomes de domínio em português verbatim do Glossário do PRD (`Jogador`, `Partida`, `Sala`/`Room`); termos técnicos genéricos (`Room`, `Schema`, `handler`) em inglês.

## UX & Interaction Patterns

- Identidade pop-art/colecionável (amarelo/vermelho/laranja, grade quadriculada) já vale para as telas deste épico via tokens de `DESIGN.md` — cor, raio de borda, espaçamento.
- **Botão Primário** (vermelho, texto branco, altura mínima 44px) usado para criar/iniciar sala; desabilitado quando a ação é inválida (nome vazio, mínimo de jogadores não atingido).
- **Lista da Sala de Espera**: uma linha por jogador esperado — nome (humano) ou pílula "IA" (fundo escuro, texto claro); atualiza em tempo real conforme gente entra ou sai.
- Estados de erro em Entrar na Sala: nome vazio mantém botão desabilitado; link de sala inexistente ou sala já cheia mostra mensagem simples e clara ("Esta sala não existe mais" / "Esta sala já está cheia"), sem travar a interface.
- Se alguém sai durante a Sala de Espera (antes da Partida começar), a pessoa simplesmente some da lista — sem estado de jogo a preservar nessa fase.
- Responsivo mobile-first: layout parte do menor viewport e escala para desktop, sem breakpoint fixo definido.
- Piso de acessibilidade: foco visível ao navegar por Tab em todo botão/campo (não é navegação completa por teclado); nenhuma informação depende só de cor; contraste sempre tinta escura sobre superfície clara.
- Voz e tom: microcópia em português direto e caloroso, nunca infantilizado nem com jargão técnico exposto (ex: "Aguardando 2 de 4 jogadores…", não "Esperando galera chegar! 🎉").
- Tela inicial oferece também um link para a FAQ (conteúdo/tela completa é do Épico 4) — não bloqueia este épico.

## Cross-Story Dependencies

- Story 1.1 (scaffolding + pirâmide de testes) é pré-requisito de toda história seguinte, deste épico em diante — nenhuma outra história tem onde rodar sem ela.
- Story 1.3 (Entrar na Sala) depende do `roomId`/link gerado pela Story 1.2 (Criar Sala).
- Story 1.4 (Sala de Espera) depende dos eventos de entrada/saída de jogador criados pelas Stories 1.2 e 1.3 chegando em tempo real.
- Story 1.5 (Publicar o Jogo) depende de 1.1-1.4 funcionando localmente antes de fazer sentido publicar.
- O botão "Iniciar" da Story 1.4 dispara o intent `iniciarPartida`, que é o gatilho de entrada no game loop do Épico 2 (transição `AguardandoJogadores → AguardandoSelecao`) — a lógica de embaralhar/distribuir/game loop em si pertence ao Épico 2, não a este épico.
- A declaração de quantidade de IA feita na Story 1.2 é só configuração; a IA realmente jogando, e a rede de segurança que converte vagas humanas não preenchidas em IA no início da Partida, são do Épico 3 (Story 3.1) — este épico não implementa esse comportamento, só captura a intenção do host.
